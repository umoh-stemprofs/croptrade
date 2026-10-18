// Dashboard cards (moved from the step-2 home page): today's exchange rates, maize
// price and weather — each with its data-source badge. All fetched on the server;
// every failure shows a sentence, never a crash.

import { prisma } from "@/lib/db";
import { getMarketProvider } from "@/lib/market/provider";
import { getFxRates, type FxRateView } from "@/lib/fx/service";
import { effectiveRates } from "@/lib/fx/effective";
import { prismaFxStore } from "@/lib/fx/prismaStore";
import { FX_ATTRIBUTION } from "@/lib/fx/rates";
import { getWeather } from "@/lib/weather/getWeather";
import { prismaSnapshotStore } from "@/lib/weather/prismaStore";
import { loadingWindow } from "@/lib/weather/loadingWindow";
import { resolveFarmLocation } from "@/lib/farm";
import { noOpSnapshotStore } from "@/lib/weather/getWeather";
import type { WeatherDay } from "@/lib/weather/types";
import { formatDateHuman, formatNairaFromKobo, formatRate } from "@/lib/format";
import { DataSourceBadge, OldRateTag, type BadgeSpec } from "@/components/DataSourceBadge";
import { RetryButton } from "@/components/RetryButton";

const card = "rounded-card border border-border bg-surface p-6 shadow-card";
const cardHead = "flex flex-wrap items-start justify-between gap-2";
const cardTitle = "text-base font-medium leading-6 text-muted";

export type RatesState =
  | { kind: "rates"; rows: FxRateView[] }
  | { kind: "error"; message: string };

export type MaizeState =
  | { kind: "price"; priceKobo: number; date: string }
  | { kind: "error"; message: string };

export type WeatherState =
  | {
      kind: "weather";
      /** true → farm lookup failed; showing the default Port Harcourt coordinates */
      defaultLocation: boolean;
      badge: BadgeSpec;
      coords: { lat: number; lon: number };
      tempC: number;
      text: string;
      humidity: number;
      windKmh: number;
      daily: WeatherDay[];
      loadingMessage: string;
    }
  | { kind: "error"; message: string };

/** Badge for one rate row: Manual > Live > Saved data. */
export function rateRowBadge(row: FxRateView): BadgeSpec {
  if (row.source === "MANUAL") return { kind: "manual" };
  if (row.live) return { kind: "live" };
  return { kind: "saved", ageLabel: formatDateHuman(row.date) };
}

export async function loadRates(userId: string): Promise<RatesState> {
  try {
    const farm = await prisma.farm.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const result = farm
      ? await effectiveRates(farm.id)
      : await getFxRates({ store: prismaFxStore });
    if (!result.ok) return { kind: "error", message: result.error };
    return { kind: "rates", rows: result.rates };
  } catch {
    return { kind: "error", message: "Exchange rates are unavailable right now. Try again later." };
  }
}

export async function loadMaize(): Promise<MaizeState> {
  try {
    const [maize] = await getMarketProvider()
      .latestPrices()
      .then((rows) => rows.filter((r) => r.crop === "MAIZE"));
    if (!maize) {
      return { kind: "error", message: "No maize price available right now. Try again later." };
    }
    return { kind: "price", priceKobo: maize.priceKobo, date: maize.date };
  } catch {
    return { kind: "error", message: "Maize price is unavailable right now. Try again later." };
  }
}

/**
 * Weather for the logged-in farmer's farm. If the farm lookup fails (slow or down
 * database) or no farm exists, show the default location (Port Harcourt) and skip
 * saving the snapshot (00-global §3).
 */
export async function loadWeather(userId: string): Promise<WeatherState> {
  try {
    const location = await resolveFarmLocation(() =>
      prisma.farm.findFirst({
        where: { userId },
        select: { id: true, lat: true, lon: true },
      })
    );
    const result = await getWeather(
      location.farmId ?? "default-location",
      location.lat,
      location.lon,
      { store: location.usedDefault ? noOpSnapshotStore : prismaSnapshotStore }
    );
    if (!result.ok) return { kind: "error", message: result.error };
    const window = loadingWindow(result.data.daily);
    return {
      kind: "weather",
      defaultLocation: location.usedDefault,
      badge:
        result.badge.kind === "live"
          ? { kind: "live" }
          : { kind: "saved", ageLabel: result.badge.ageLabel },
      coords: { lat: location.lat, lon: location.lon },
      tempC: result.data.current.tempC,
      text: result.data.current.text,
      humidity: result.data.current.humidity,
      windKmh: result.data.current.windKmh,
      daily: result.data.daily,
      loadingMessage: window.message,
    };
  } catch {
    return { kind: "error", message: "Weather is unavailable right now. Try again in a few minutes." };
  }
}

export function RatesCard({ state }: { state: RatesState }) {
  return (
    <section className={card} aria-labelledby="rates-title">
      <div className={cardHead}>
        <h2 id="rates-title" className={cardTitle}>
          Today’s exchange rates
        </h2>
        {state.kind === "rates" ? (
          <DataSourceBadge
            badge={
              state.rows.some((r) => r.live)
                ? { kind: "live" }
                : state.rows.some((r) => r.source === "MANUAL")
                  ? { kind: "manual" }
                  : { kind: "saved", ageLabel: state.rows[0] ? `${state.rows[0].date}` : "unknown" }
            }
          />
        ) : null}
      </div>
      {state.kind === "error" ? (
        <div className="mt-4 flex items-center gap-3">
          <p role="alert" className="text-base text-danger">
            {state.message}
          </p>
          <RetryButton />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {state.rows.map((row) => (
            <li key={row.quote} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-base text-text">
                1 {row.quote} ={" "}
                <span className="font-semibold tabular-nums">{formatRate(row.localPerForeign)}</span>
              </span>
              <span className="flex items-center gap-2">
                {row.old ? <OldRateTag /> : null}
                <DataSourceBadge badge={rateRowBadge(row)} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm leading-5 text-muted">
        Rates meaning “1 foreign = X local”.{" "}
        <a
          href={FX_ATTRIBUTION.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2"
        >
          {FX_ATTRIBUTION.label}
        </a>
      </p>
    </section>
  );
}

export function MaizeCard({ state }: { state: MaizeState }) {
  return (
    <section className={card} aria-labelledby="maize-title">
      <div className={cardHead}>
        <h2 id="maize-title" className={cardTitle}>
          Maize price
        </h2>
        {state.kind === "price" ? <DataSourceBadge badge={{ kind: "simulated" }} /> : null}
      </div>
      {state.kind === "error" ? (
        <div className="mt-4 flex items-center gap-3">
          <p role="alert" className="text-base text-danger">
            {state.message}
          </p>
          <RetryButton />
        </div>
      ) : (
        <>
          <p className="mt-4 text-[40px] font-bold leading-[48px] tabular-nums">
            {formatNairaFromKobo(state.priceKobo)}
            <span className="ml-2 text-base font-medium text-muted">per kg</span>
          </p>
          <p className="mt-2 text-sm leading-5 text-muted">As of {formatDateHuman(state.date)}</p>
        </>
      )}
    </section>
  );
}

export function WeatherCard({ state }: { state: WeatherState }) {
  return (
    <section className={card} aria-labelledby="weather-title">
      <div className={cardHead}>
        <h2 id="weather-title" className={cardTitle}>
          {state.kind === "weather" && state.defaultLocation
            ? "Weather — Port Harcourt (default location)"
            : "Weather — your farm"}
        </h2>
        {state.kind === "weather" ? <DataSourceBadge badge={state.badge} /> : null}
      </div>
      {state.kind === "error" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p role="alert" className="text-base text-danger">
            {state.message}
          </p>
          <RetryButton />
        </div>
      ) : (
        <>
          <p className="mt-4 text-[40px] font-bold leading-[48px] tabular-nums">
            {Math.round(state.tempC)}°C
            <span className="ml-2 text-base font-medium text-muted">{state.text}</span>
          </p>
          <p className="mt-2 text-sm leading-5 text-muted">
            Humidity {Math.round(state.humidity)}% · Wind {Math.round(state.windKmh)} km/h
          </p>
          <p className="mt-2 text-base leading-6 text-text">{state.loadingMessage}</p>
        </>
      )}
    </section>
  );
}
