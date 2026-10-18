// Weather (S-WEATHER): the farm's own coordinates, current conditions, the full
// 5-day forecast and the loading window card, each with its data-source badge.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { loadWeather } from "@/components/dashboard/Cards";
import { formatDateShort } from "@/lib/format";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { RetryButton } from "@/components/RetryButton";
import { StatCard } from "@/components/StatCard";

export const dynamic = "force-dynamic";

export default async function WeatherPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const state = await loadWeather(user.id);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-[32px] font-bold leading-10">Weather</h1>
        <p className="mt-1 text-base leading-6 text-muted">
          The forecast for your farm, used to find a dry loading day.
        </p>
      </header>

      {state.kind === "error" ? (
        <section className="rounded-card border border-border bg-surface p-6 shadow-card">
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
            <section
              className="rounded-card border border-border bg-surface p-6 shadow-card"
              aria-labelledby="now-title"
            >
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

          <section className="mt-6 rounded-card border border-border bg-surface p-6 shadow-card">
            <h2 className="text-[20px] font-semibold leading-7">Next 5 days</h2>
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
