// Farm Weather — the Google Stitch farm_weather page. The farm's own coordinates,
// current conditions, the drying-status banner, the 5-day haulage outlook and the
// live Doppler radar — every figure from Open-Meteo / RainViewer. The GO/NO-GO
// flags come from real forecast numbers (rain volume, rain chance, barometric
// 3-hour fall) — never invented. The prototype's "Live" badges and simulated
// sensor readings are removed; a missing reading shows an honest "—".

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { loadWeather } from "@/components/dashboard/Cards";
import { formatDateHuman } from "@/lib/format";
import { dispatchMatrix, type DispatchStatus } from "@/lib/weather/goNoGo";
import type { WeatherDay } from "@/lib/weather/types";
import { RadarMap } from "@/components/weather/RadarMap";

export const dynamic = "force-dynamic";

function weatherIcon(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("thunder")) return "thunderstorm";
  if (t.includes("snow") || t.includes("sleet")) return "weather_snowy";
  if (t.includes("rain") || t.includes("drizzle") || t.includes("shower")) return "rainy";
  if (t.includes("fog") || t.includes("mist")) return "foggy";
  if (t.includes("partly")) return "partly_cloudy_day";
  if (t.includes("cloud") || t.includes("overcast")) return "cloud";
  if (t.includes("clear") || t.includes("sun")) return "wb_sunny";
  return "weather_partly_cloudy";
}

function weekdayLong(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
  });
}

/** Verdict pill per dispatch flag — the prototype's day-card footer strip. */
function verdictFor(status: DispatchStatus): { text: string; cls: string } {
  switch (status.flag) {
    case "GO":
      return { text: "Optimal dry loading window", cls: "bg-primary/10 text-primary" };
    case "CAUTION":
      return { text: "Caution: showers likely", cls: "bg-tertiary-fixed text-on-tertiary-fixed" };
    case "NO-GO":
      return { text: "CRITICAL: NO-GO DISPATCH", cls: "bg-error text-on-error font-bold shadow-sm" };
  }
}

export default async function WeatherPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const state = await loadWeather(user.id);
  const matrix = state.kind === "weather" ? dispatchMatrix(state.daily, state.barometric) : [];
  const goDays = matrix.filter((m) => m.flag === "GO").length;
  const firstDryDay = state.kind === "weather" ? state.daily.find((d) => d.rainMm < 5) ?? null : null;
  const maxMm = state.kind === "weather" ? Math.max(...state.daily.map((d) => d.rainMm), 1) : 1;
  const worstDrop = matrix.reduce<number | null>(
    (worst, m) => (m.drop3h !== null && (worst === null || m.drop3h > worst) ? m.drop3h : worst),
    null
  );

  return (
    <>
      {/* ── Telemetry bar ─────────────────────────────────────────────── */}
      <div className="w-full bg-surface-container-low rounded-xl px-space-md py-space-xs mb-space-lg flex flex-wrap items-center justify-between gap-space-sm shadow-sm">
        <div className="flex items-center gap-space-md text-on-surface-variant font-data-mono text-label-sm flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="uppercase tracking-wider font-bold text-on-surface">AGRI-MET · OPEN-METEO</span>
          </div>
          <span className="text-outline-variant">•</span>
          <span>
            STATION:{" "}
            {state.kind === "weather"
              ? `${state.coords.lat.toFixed(4)}° ${state.coords.lat >= 0 ? "N" : "S"}, ${state.coords.lon.toFixed(4)}° ${state.coords.lon >= 0 ? "E" : "W"}`
              : "UNAVAILABLE"}
          </span>
          <span className="text-outline-variant hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            {state.kind === "weather"
              ? state.defaultLocation
                ? "DEFAULT LOCATION (PORT HARCOURT)"
                : "FARM CALIBRATED"
              : "FEED OFFLINE"}
          </span>
        </div>
        <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm">
          <span className="material-symbols-outlined text-[16px] text-primary">satellite_alt</span>
          <span>
            {state.kind === "weather"
              ? state.badge.kind === "live"
                ? "FRESH READING"
                : "ageLabel" in state.badge
                  ? `SAVED READING · ${state.badge.ageLabel.toUpperCase()}`
                  : "SAVED READING"
              : "AWAITING FEED"}
          </span>
        </div>
      </div>

      {state.kind === "error" ? (
        <section className="w-full bg-surface-container-lowest rounded-xl border border-error/40 shadow-sm px-space-lg py-space-xl text-center">
          <span className="material-symbols-outlined text-[40px] text-error">storm</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold mt-space-sm">
            Weather is unavailable
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">{state.message}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Every reading on this page comes from the live forecast — nothing is substituted.
          </p>
        </section>
      ) : (
        <>
          {/* ── Hero: instrument + headline + sensor array ────────────── */}
          <div className="w-full bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-space-md sm:p-space-lg mb-space-lg">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8">
                <div className="relative w-32 h-32 sm:w-40 sm:h-40 shrink-0 bg-surface-container-low rounded-xl p-3 flex items-center justify-center shadow-inner">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontSize: 96, fontVariationSettings: "'FILL' 1" }}
                    aria-hidden="true"
                  >
                    {weatherIcon(state.text)}
                  </span>
                  <span className="absolute bottom-2 right-2 text-primary bg-surface-container-lowest px-2 py-0.5 rounded-full font-label-sm text-label-sm shadow-sm">
                    {state.badge.kind === "live" ? "Real-time" : "Saved"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-bold">
                    Atmospheric Status
                  </span>
                  <div className="font-display text-display-lg-mobile sm:text-[44px] sm:leading-[52px] font-extrabold text-on-surface tracking-tight tabular-nums">
                    {Math.round(state.tempC)}°C
                  </div>
                  <div className="font-headline-md text-headline-md text-secondary font-bold tracking-normal uppercase">
                    {state.text}
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    {state.defaultLocation
                      ? `Farm lookup failed — showing the default Port Harcourt station (${state.coords.lat.toFixed(4)}, ${state.coords.lon.toFixed(4)}).`
                      : `Calibrated on your farm's coordinates (${state.coords.lat.toFixed(4)}, ${state.coords.lon.toFixed(4)}).`}{" "}
                    {state.loadingMessage}
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5 grid grid-cols-3 gap-3">
                <div className="bg-surface-container rounded-xl p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-on-surface-variant mb-2">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider">Humidity</span>
                    <span className="material-symbols-outlined text-secondary text-[20px]" aria-hidden="true">
                      water_drop
                    </span>
                  </div>
                  <div className="font-headline-md text-headline-md text-on-surface font-bold tabular-nums">
                    {Math.round(state.humidity)}
                    <span className="font-title-md text-body-sm text-on-surface-variant font-normal">%</span>
                  </div>
                  <div className="font-label-sm text-label-sm text-on-surface-variant mt-1">Relative</div>
                </div>
                <div className="bg-surface-container rounded-xl p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-on-surface-variant mb-2">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider">Pressure</span>
                    <span className="material-symbols-outlined text-tertiary text-[20px]" aria-hidden="true">
                      speed
                    </span>
                  </div>
                  <div className="font-headline-md text-headline-md text-on-surface font-bold tabular-nums">
                    {state.pressureHpa !== null ? Math.round(state.pressureHpa) : "—"}
                    {state.pressureHpa !== null ? (
                      <span className="font-title-md text-body-sm text-on-surface-variant font-normal">hPa</span>
                    ) : null}
                  </div>
                  <div className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                    {state.pressureHpa !== null ? "Mean sea level" : "Not reported by provider"}
                  </div>
                </div>
                <div className="bg-surface-container rounded-xl p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-on-surface-variant mb-2">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider">Wind</span>
                    <span className="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">
                      air
                    </span>
                  </div>
                  <div className="font-headline-md text-headline-md text-on-surface font-bold tabular-nums">
                    {Math.round(state.windKmh)}
                    <span className="font-title-md text-body-sm text-on-surface-variant font-normal">km/h</span>
                  </div>
                  <div className="font-label-sm text-label-sm text-on-surface-variant mt-1">Current speed</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Drying-status banner (real forecast maths) ────────────── */}
          <div
            className={`w-full min-h-[64px] rounded-xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-space-lg ${
              firstDryDay
                ? "bg-primary-container text-on-primary-container"
                : "bg-error-container text-on-error-container"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-on-primary-container/15 flex items-center justify-center shrink-0">
                <span
                  className={`material-symbols-outlined text-[30px] ${firstDryDay ? "text-on-primary-container" : "text-error"}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  aria-hidden="true"
                >
                  {firstDryDay ? "check_circle" : "rainy"}
                </span>
              </div>
              <div className="flex flex-col">
                <div className="font-headline-md text-headline-md sm:text-[24px] sm:leading-[30px] font-bold tracking-tight">
                  {firstDryDay
                    ? `DRYING STATUS: GOOD TO DRY — BEST WINDOW ${weekdayLong(firstDryDay.date).toUpperCase()}`
                    : "DRYING STATUS: NO DRY WINDOW AHEAD"}
                </div>
                <p className="font-body-md text-body-md opacity-90 mt-1 max-w-3xl">
                  {firstDryDay
                    ? `${weekdayLong(firstDryDay.date)} forecasts ${firstDryDay.rainMm.toFixed(1)} mm at ${Math.round(firstDryDay.rainChancePct)}% chance — under your 5 mm threshold. ${goDays} of ${matrix.length} days carry a GO dispatch flag.`
                    : `Every one of the next ${state.daily.length} days forecasts at or above 5 mm of rain. Plan covered loading and check the radar below.`}
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-3 w-full md:w-auto justify-end">
              <Link
                href="/stock"
                className="px-5 py-3 rounded-lg bg-surface-container-lowest text-primary font-title-md text-title-md hover:bg-surface-container transition-colors shadow-sm flex items-center gap-2 min-h-[44px]"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  inventory_2
                </span>
                Open Stock Ledger
              </Link>
            </div>
          </div>

          {/* ── Forecast accordion ────────────────────────────────────── */}
          <WeatherAccordion daily={state.daily} matrix={matrix} maxMm={maxMm} worstDrop={worstDrop} />

          {/* ── Doppler radar ─────────────────────────────────────────── */}
          <div className="w-full bg-surface-container-lowest rounded-xl p-space-md sm:p-space-lg shadow-md mt-space-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-space-md">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    satellite_alt
                  </span>
                </div>
                <div>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface">
                    Regional Cloud Doppler &amp; Surface Radar
                  </h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Live RainViewer composite centred on your farm
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-data-mono text-label-sm bg-surface-container px-3 py-1.5 rounded-lg text-on-surface tabular-nums">
                  Scan: {state.coords.lat.toFixed(4)}° {state.coords.lat >= 0 ? "N" : "S"},{" "}
                  {state.coords.lon.toFixed(4)}° {state.coords.lon >= 0 ? "E" : "W"}
                </span>
              </div>
            </div>
            <div className="w-full overflow-x-auto">
              <RadarMap lat={state.coords.lat} lon={state.coords.lon} width={1040} height={340} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ── Forecast accordion (client-free details/summary) ───────────────────── */

function WeatherAccordion({
  daily,
  matrix,
  maxMm,
  worstDrop,
}: {
  daily: WeatherDay[];
  matrix: DispatchStatus[];
  maxMm: number;
  worstDrop: number | null;
}) {
  return (
    <details
      open
      className="w-full bg-surface-container-lowest rounded-xl shadow-md overflow-hidden group"
    >
      <summary className="w-full min-h-[60px] px-space-md sm:px-6 py-4 flex items-center justify-between bg-surface-container-low hover:bg-surface-container transition-all cursor-pointer text-left list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              calendar_month
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-title-md text-title-md text-on-surface font-bold flex items-center gap-2">
              <span className="text-primary font-bold text-headline-sm inline-block transition-transform duration-200 group-open:rotate-180">
                ▼
              </span>
              5-Day Rainfall Forecast
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Synoptic outlook, precipitation volumes &amp; dispatch readiness diagnostics
            </span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 font-label-md text-label-md text-primary font-semibold">
          <span>{worstDrop !== null ? `Max pressure fall ${worstDrop.toFixed(1)} hPa / 3 h` : "Open details"}</span>
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            unfold_more
          </span>
        </div>
      </summary>

      <div className="p-space-md sm:p-space-lg space-y-space-lg bg-surface-container-lowest">
        {/* 5-day haulage & drying outlook */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              5-Day Haulage &amp; Drying Outlook
            </h3>
            <span className="font-data-mono text-label-sm text-on-surface-variant">
              OPEN-METEO FORECAST · {formatDateHuman(daily[0]?.date ?? new Date().toISOString().slice(0, 10)).toUpperCase()} ONWARDS
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {daily.map((day, index) => {
              const status = matrix[index];
              const flag = status?.flag ?? null;
              const verdict = status ? verdictFor(status) : null;
              const critical = flag === "NO-GO";
              const barWidth = Math.min(100, Math.round((day.rainMm / maxMm) * 100));
              return (
                <div
                  key={day.date}
                  className={`rounded-xl p-4 flex flex-col justify-between gap-4 hover:shadow-md transition-shadow ${
                    critical ? "bg-error-container/40 shadow-sm" : "bg-surface-container-low"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-title-md text-title-md font-bold ${critical ? "text-error" : "text-on-surface"}`}
                    >
                      {weekdayLong(day.date)}
                    </span>
                    <span
                      className={`material-symbols-outlined text-[22px] ${critical ? "text-error" : flag === "GO" ? "text-primary" : "text-secondary"}`}
                      aria-hidden="true"
                    >
                      {critical
                        ? "thunderstorm"
                        : day.rainChancePct >= 70
                          ? "rainy"
                          : day.rainChancePct >= 40
                            ? "partly_cloudy_day"
                            : "wb_sunny"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`font-headline-lg text-headline-lg tabular-nums ${critical ? "text-error" : "text-on-surface"}`}
                      >
                        {Math.round(day.maxC)}°
                      </span>
                      <span
                        className={`font-title-md text-body-md tabular-nums ${critical ? "text-error/80" : "text-on-surface-variant"}`}
                      >
                        / {Math.round(day.minC)}°C
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-2 font-label-sm text-label-sm ${critical ? "text-error" : "text-on-surface-variant"}`}
                    >
                      <span className="text-secondary font-bold tabular-nums">
                        {Math.round(day.rainChancePct)}% Rain Prob
                      </span>
                      <span>•</span>
                      <span className="font-data-mono font-bold tabular-nums">{day.rainMm.toFixed(1)} mm</span>
                    </div>
                  </div>
                  <div className={`w-full ${critical ? "bg-error-container" : "bg-surface-container-high"} h-2 rounded-full overflow-hidden`}>
                    <div
                      className={`h-full rounded-full ${critical ? "bg-error" : flag === "GO" ? "bg-primary" : "bg-secondary"}`}
                      style={{ width: `${barWidth}%` }}
                    ></div>
                  </div>
                  {verdict ? (
                    <div className="pt-2">
                      <span
                        className={`inline-block w-full font-label-sm text-label-sm font-semibold p-2 rounded-lg leading-tight text-center ${verdict.cls}`}
                      >
                        {verdict.text}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dispatch readiness diagnostic — derived entirely from the forecast */}
        <div className="bg-surface-container rounded-xl p-space-md sm:p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">
                task_alt
              </span>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                Dispatch Readiness Diagnostic
              </h4>
            </div>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-full">
              Calculated from the forecast
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div className="bg-surface-container-lowest rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${firstDryDayClass(matrix)}`}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  water_drop
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-title-md text-title-md text-on-surface font-bold">Loading window</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  {matrix.some((m) => m.flag === "GO")
                    ? `${matrix.filter((m) => m.flag === "GO").length} day(s) below the 5 mm threshold in the next ${matrix.length}`
                    : "No day below the 5 mm threshold in the forecast window"}
                </p>
                <span className="font-label-sm text-label-sm text-primary mt-2">Assessed on rain volume + chance</span>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  speed
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-title-md text-title-md text-on-surface font-bold">Barometric trend</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  {worstDrop !== null
                    ? `Worst 3-hour fall: ${worstDrop.toFixed(1)} hPa (lock threshold 4.5 hPa)`
                    : "Pressure trend unavailable from the provider"}
                </p>
                <span className="font-label-sm text-label-sm text-primary mt-2">
                  {worstDrop !== null && worstDrop >= 4.5
                    ? "Storm lock threshold reached on at least one day"
                    : "Below the storm lock threshold"}
                </span>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  radar
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-title-md text-title-md text-on-surface font-bold">Doppler coverage</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Live RainViewer composite centred on your farm coordinates
                </p>
                <span className="font-label-sm text-label-sm text-secondary mt-2">
                  Frame timestamp shown on the map
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2 pt-3 flex flex-wrap items-center justify-between gap-3 text-on-surface-variant font-label-sm text-label-sm border-t border-outline-variant">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-tertiary" aria-hidden="true">
                info
              </span>
              <span>Pre-dispatch protocol locks automatically when barometric drop exceeds 4.5 hPa/3h</span>
            </div>
            <span className="font-data-mono">SOURCE: OPEN-METEO</span>
          </div>
        </div>
      </div>
    </details>
  );
}

function firstDryDayClass(matrix: DispatchStatus[]): string {
  return matrix.some((m) => m.flag === "GO")
    ? "bg-primary-container text-on-primary-container"
    : "bg-error-container text-on-error-container";
}
