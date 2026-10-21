// Weather (S-WEATHER): the farm's own coordinates, current conditions, the dispatch
// GO/NO-GO matrix, the 5-day forecast, the live Doppler radar and the loading-window
// card — each with its data-source badge. The GO/NO-GO flags come from real forecast
// numbers (rain volume, rain chance, barometric 3-hour fall) — never invented.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { loadWeather } from "@/components/dashboard/Cards";
import { formatDateShort } from "@/lib/format";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { RetryButton } from "@/components/RetryButton";
import { StatCard } from "@/components/StatCard";
import { dispatchMatrix, type DispatchStatus } from "@/lib/weather/goNoGo";
import { RadarMap } from "@/components/weather/RadarMap";

export const dynamic = "force-dynamic";

const card = "rounded-card border border-border bg-surface p-6 shadow-card";

/** Flag → colour + label classes. Status is never colour alone: the word is shown too. */
function flagStyle(flag: DispatchStatus["flag"]): { box: string; dot: string; word: string } {
  switch (flag) {
    case "GO":
      return {
        box: "border-success/30 bg-success-bg",
        dot: "bg-success",
        word: "text-success",
      };
    case "CAUTION":
      return {
        box: "border-warning/30 bg-warning-bg",
        dot: "bg-warning",
        word: "text-warning",
      };
    case "NO-GO":
      return {
        box: "border-danger/30 bg-danger-bg",
        dot: "bg-danger",
        word: "text-danger",
      };
  }
}

export default async function WeatherPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const state = await loadWeather(user.id);
  const matrix = state.kind === "weather" ? dispatchMatrix(state.daily, state.barometric) : [];

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-label-sm uppercase tracking-widest text-accent">
              Atmospheric intelligence
            </span>
            <span className="text-data-mono text-muted">AGRI-MET · OPEN-METEO</span>
          </div>
          <h1 className="font-display text-display-lg-mobile sm:text-display-lg">
            Farm Weather
          </h1>
          <p className="mt-1 text-base leading-6 text-muted">
            Coordinate-calibrated atmospheric monitoring for crop drying and haulage dispatch.
          </p>
        </div>
        {state.kind === "weather" ? (
          <div className="inline-flex flex-col gap-1.5 self-start rounded-card border border-border bg-surface px-4 py-3 shadow-card">
            <span className="text-title-md text-text">Station coordinates</span>
            <span className="text-data-mono text-muted">
              Station {state.coords.lat.toFixed(4)}°{" "}
              {state.coords.lat >= 0 ? "N" : "S"}, {state.coords.lon.toFixed(4)}°{" "}
              {state.coords.lon >= 0 ? "E" : "W"}
            </span>
            <span className="flex items-center gap-2 text-label-sm text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Calibrated live from Open-Meteo
            </span>
          </div>
        ) : null}
      </header>

      {state.kind === "error" ? (
        <section className={card}>
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-base text-danger">
              {state.message}
            </p>
            <RetryButton />
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className={card} aria-labelledby="now-title">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 id="now-title" className="text-base font-medium leading-6 text-muted">
                  Now
                </h2>
                <DataSourceBadge badge={state.badge} />
              </div>
              <p className="mt-3 text-[40px] font-bold leading-[48px] tabular-nums">
                {Math.round(state.tempC)}°C
                <span className="ml-2 text-base font-medium text-muted">{state.text}</span>
              </p>
              <p className="mt-2 text-sm leading-5 text-muted">
                Humidity {Math.round(state.humidity)}% · Wind {Math.round(state.windKmh)} km/h
                {state.pressureHpa !== null ? (
                  <>
                    {" "}
                    · Pressure{" "}
                    <span className="tabular-nums text-text">
                      {Math.round(state.pressureHpa)} hPa
                    </span>
                  </>
                ) : null}
              </p>
              <p className="mt-4 text-sm leading-5 text-muted">
                {state.defaultLocation
                  ? `Default location: Port Harcourt (${state.coords.lat.toFixed(4)}, ${state.coords.lon.toFixed(4)}) — your farm could not be loaded.`
                  : `Farm coordinates: ${state.coords.lat.toFixed(4)}, ${state.coords.lon.toFixed(4)}`}
              </p>
            </section>

            <StatCard
              label="Next loading window"
              value={state.loadingMessage}
              valueSize="small"
              sub="First of the next 5 days with less than 5 mm of rain."
              badge={state.badge}
            />
          </div>

          {/* Dispatch GO/NO-GO matrix — flags derived from real forecast numbers */}
          <section className="mt-6 rounded-card border border-border bg-surface p-6 shadow-card" aria-labelledby="matrix-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="matrix-title" className="text-headline-sm">
                5-day dispatch readiness
              </h2>
              <span className="font-mono text-xs text-muted">
                Lock at &gt; 4.5 hPa fall in 3 h
              </span>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {matrix.map((status) => {
                const style = flagStyle(status.flag);
                return (
                  <li
                    key={status.date}
                    className={`rounded-card border p-4 ${style.box}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium leading-5 text-muted">
                        {formatDateShort(status.date)}
                      </p>
                      <span
                        className="inline-flex items-center gap-1.5 text-sm font-semibold"
                        aria-label={`Dispatch ${status.flag}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
                        <span className={style.word}>{status.flag}</span>
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-5 text-text tabular-nums">
                      {Math.round(status.rainMm)} mm · {Math.round(status.rainChancePct)}%
                    </p>
                    {status.drop3h !== null ? (
                      <p className="mt-1 text-sm leading-5 text-muted tabular-nums">
                        Pressure −{status.drop3h.toFixed(1)} hPa / 3 h
                      </p>
                    ) : (
                      <p className="mt-1 text-sm leading-5 text-muted">Pressure trend unavailable</p>
                    )}
                    <p className="mt-2 text-xs leading-4 text-muted">{status.reason}</p>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Live Doppler radar over the farm */}
          <section className="mt-6 rounded-card border border-border bg-surface p-6 shadow-card" aria-labelledby="radar-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="radar-title" className="text-headline-sm">
                Doppler radar
              </h2>
              <DataSourceBadge badge={{ kind: "live", note: "RainViewer" }} />
            </div>
            <p className="mt-1 text-sm leading-5 text-muted">
              Live precipitation composite centred on your farm.
            </p>
            <div className="mt-4">
              <RadarMap lat={state.coords.lat} lon={state.coords.lon} width={720} height={320} />
            </div>
          </section>

          <section className="mt-6 rounded-card border border-border bg-surface p-6 shadow-card">
            <h2 className="text-headline-sm">Next 5 days</h2>
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {state.daily.map((day) => (
                <li
                  key={day.date}
                  className="rounded-card border border-border bg-bg p-4 text-center"
                >
                  <p className="text-sm font-medium leading-5 text-muted">
                    {formatDateShort(day.date)}
                  </p>
                  <p className="mt-2 text-[24px] font-bold leading-8 tabular-nums">
                    {Math.round(day.maxC)}°
                    <span className="text-base font-medium text-muted">
                      {" "}
                      / {Math.round(day.minC)}°
                    </span>
                  </p>
                  <p className="mt-2 text-sm leading-5 text-text">
                    Rain {Math.round(day.rainMm)} mm
                  </p>
                  <p className="text-sm leading-5 text-muted">
                    {Math.round(day.rainChancePct)}% chance
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
