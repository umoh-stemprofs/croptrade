// Home page (step 2): three small data cards — today's exchange rates, maize price,
// weather for the farm — each with its data-source badge (Live / Saved data / Simulated).
// All data is fetched on the server; every failure shows a sentence, never a crash.

import { prisma } from "@/lib/db";
import { resolveFarmLocation } from "@/lib/farm";
import { getMarketProvider } from "@/lib/market/provider";
import { getFxRates } from "@/lib/fx/service";
import { prismaFxStore } from "@/lib/fx/prismaStore";
import { FX_ATTRIBUTION } from "@/lib/fx/rates";
import { getWeather, noOpSnapshotStore } from "@/lib/weather/getWeather";
import { prismaSnapshotStore } from "@/lib/weather/prismaStore";
import { loadingWindow } from "@/lib/weather/loadingWindow";
import { formatDateHuman, formatNairaFromKobo, formatRate } from "@/lib/format";
import { DataSourceBadge, OldRateTag, type BadgeSpec } from "@/components/DataSourceBadge";
import { RetryButton } from "@/components/RetryButton";

export const dynamic = "force-dynamic";

const card =
  "rounded-card border border-border bg-surface p-6 shadow-card";
const cardHead =
  "flex flex-wrap items-start justify-between gap-2";
const cardTitle = "text-base font-medium text-muted";

type RatesState =
  | { kind: "rates"; rows: import("@/lib/fx/service").FxRateView[] }
  | { kind: "error"; message: string };

type MaizeState =
  | { kind: "price"; priceKobo: number; date: string }
  | { kind: "error"; message: string };

type WeatherState =
  | {
      kind: "weather";
      /** true → farm lookup failed, showing the default Port Harcourt coordinates. */
      defaultLocation: boolean;
      badge: BadgeSpec;
      tempC: number;
      text: string;
      humidity: number;
      windKmh: number;
      loadingMessage: string;
    }
  | { kind: "error"; message: string };

async function loadRates(): Promise<RatesState> {
  try {
    const result = await getFxRates({ store: prismaFxStore });
    if (!result.ok) return { kind: "error", message: result.error };
    return { kind: "rates", rows: result.rates };
  } catch {
    return { kind: "error", message: "Exchange rates are unavailable right now. Try again later." };
  }
}

async function loadMaize(): Promise<MaizeState> {
  try {
    const [maize] = await getMarketProvider().latestPrices().then((rows) =>
      rows.filter((r) => r.crop === "MAIZE")
    );
    if (!maize) {
      return { kind: "error", message: "No maize price available right now. Try again later." };
    }
    return { kind: "price", priceKobo: maize.priceKobo, date: maize.date };
  } catch {
    return { kind: "error", message: "Maize price is unavailable right now. Try again later." };
  }
}

async function loadWeather(): Promise<WeatherState> {
  try {
    // If the farm lookup fails (slow or down database) or no farm exists yet,
    // show the weather for the default location (Port Harcourt) and skip
    // saving the snapshot — there is no farm row to save under.
    const location = await resolveFarmLocation(() =>
      prisma.farm.findFirst({ select: { id: true, lat: true, lon: true } })
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
      tempC: result.data.current.tempC,
      text: result.data.current.text,
      humidity: result.data.current.humidity,
      windKmh: result.data.current.windKmh,
      loadingMessage: window.message,
    };
  } catch {
    return { kind: "error", message: "Weather is unavailable right now. Try again in a few minutes." };
  }
}

function RatesCard({ state }: { state: RatesState }) {
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
          <p className="text-base text-danger">{state.message}</p>
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
                <DataSourceBadge
                  badge={
                    row.source === "MANUAL"
                      ? { kind: "manual" }
                      : row.live
                        ? { kind: "live" }
                        : { kind: "saved", ageLabel: formatDateHuman(row.date) }
                  }
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-muted">
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

function MaizeCard({ state }: { state: MaizeState }) {
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
          <p className="text-base text-danger">{state.message}</p>
          <RetryButton />
        </div>
      ) : (
        <>
          <p className="mt-4 text-[40px] font-bold leading-[48px] tabular-nums">
            {formatNairaFromKobo(state.priceKobo)}
            <span className="ml-2 text-base font-medium text-muted">per kg</span>
          </p>
          <p className="mt-2 text-sm text-muted">As of {formatDateHuman(state.date)}</p>
        </>
      )}
    </section>
  );
}

function WeatherCard({ state }: { state: WeatherState }) {
  return (
    <section className={card} aria-labelledby="weather-title">
      <div className={cardHead}>
        <h2 id="weather-title" className={cardTitle}>
          {state.kind === "weather" && state.defaultLocation
            ? "Weather — Port Harcourt (default location)"
            : "Weather — Demo Farm"}
        </h2>
        {state.kind === "weather" ? <DataSourceBadge badge={state.badge} /> : null}
      </div>
      {state.kind === "error" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-base text-danger">{state.message}</p>
          <RetryButton />
        </div>
      ) : (
        <>
          <p className="mt-4 text-[40px] font-bold leading-[48px] tabular-nums">
            {Math.round(state.tempC)}°C
            <span className="ml-2 text-base font-medium text-muted">{state.text}</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            Humidity {Math.round(state.humidity)}% · Wind {Math.round(state.windKmh)} km/h
          </p>
          <p className="mt-2 text-base text-text">{state.loadingMessage}</p>
        </>
      )}
    </section>
  );
}

export default async function HomePage() {
  const [rates, maize, weather] = await Promise.all([
    loadRates(),
    loadMaize(),
    loadWeather(),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-[1280px] px-6 py-8">
      <header className="mb-8">
        <h1 className="text-[32px] font-bold leading-10">CropTrade</h1>
        <p className="mt-1 text-lg leading-7 text-muted">
          What is my crop worth abroad?
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <RatesCard state={rates} />
        <MaizeCard state={maize} />
        <WeatherCard state={weather} />
      </div>

      <footer className="mt-8 text-sm text-muted">
        Decision-support tool. You decide. Sample prices are placeholders.
      </footer>
    </main>
  );
}
