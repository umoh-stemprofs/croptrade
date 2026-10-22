"use client";

// Farm Overview — the Google Stitch farm_overview page, structure and classes
// copied verbatim from the prototype, with every figure wired to real data:
// stock + WFP prices, the FX rate, and the Open-Meteo forecast. The prototype's
// "Simulated"/"Live FX" badges are gone (removed per request), and anything the
// feeds cannot answer shows an honest empty state instead of a fake number.

import Link from "next/link";
import { useState } from "react";
import { APP_TZ } from "@/lib/config";
import { cropLabel } from "@/lib/inventory";
import {
  formatDateHuman,
  formatDateShort,
  formatNairaFromKobo,
  formatRate,
  formatUsd,
} from "@/lib/format";
import {
  dispatchMatrix,
  type DispatchFlag,
} from "@/lib/weather/goNoGo";
import type {
  DayBarometricRecord,
  WeatherDay,
} from "@/lib/weather/types";

export interface OverviewCrop {
  crop: string;
  qtyKg: number;
  valueKobo: number;
  /** Latest WFP price for this crop (null when the feed has no row for it). */
  priceKobo: number | null;
  lots: { qtyKg: number; note: string | null }[];
}

export interface OverviewWeather {
  coords: { lat: number; lon: number };
  /** true → farm lookup failed; showing the default Port Harcourt coordinates. */
  defaultLocation: boolean;
  tempC: number;
  text: string;
  humidity: number;
  windKmh: number;
  pressureHpa: number | null;
  daily: WeatherDay[];
  barometric: DayBarometricRecord[];
}

export interface OverviewProps {
  crops: OverviewCrop[];
  totalKobo: number;
  /** YYYY-MM-DD of the newest WFP price row, or null when the feed returned nothing. */
  priceDate: string | null;
  /** Naira per USD (null when no rate has been fetched or saved). */
  usdRate: number | null;
  usdRateDate: string | null;
  usdRateOld: boolean;
  /** Server-formatted clock + ISO week, e.g. "UTC 08:42 · WK41.RII". */
  tradingCycle: string;
  weather: OverviewWeather | null;
  weatherError: string | null;
}

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
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: APP_TZ,
  });
}

function coordLabel(value: number, axis: "lat" | "lon"): string {
  const hemi = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(4)}° ${hemi}`;
}

const flagChip: Record<DispatchFlag, string> = {
  GO: "px-2.5 py-0.5 rounded font-label-sm text-label-sm font-bold bg-primary/10 text-primary border border-primary/30",
  CAUTION:
    "px-2.5 py-0.5 rounded font-label-sm text-label-sm font-bold bg-tertiary/12 text-tertiary-strong border border-tertiary/30",
  "NO-GO":
    "px-2.5 py-0.5 rounded font-label-sm text-label-sm font-bold bg-error/10 text-error border border-error/30",
};

export function Overview(props: OverviewProps) {
  const { crops, totalKobo, priceDate, usdRate, usdRateDate, usdRateOld, tradingCycle, weather, weatherError } = props;

  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [threshold, setThreshold] = useState(5);
  const [trucks, setTrucks] = useState(2);
  const [payload, setPayload] = useState(500);

  const usdValue = usdRate ? totalKobo / 100 / usdRate : null;
  const totalKg = crops.reduce((sum, c) => sum + c.qtyKg, 0);

  const matrix = weather ? dispatchMatrix(weather.daily, weather.barometric) : [];
  const goDays = matrix.filter((m) => m.flag === "GO").length;

  const dryDay = weather?.daily.find((d) => d.rainMm < threshold) ?? null;

  const bigValue =
    currency === "NGN"
      ? formatNairaFromKobo(totalKobo)
      : usdValue !== null
        ? formatUsd(usdValue)
        : "—";
  const altValue =
    currency === "NGN"
      ? usdValue !== null
        ? `≈ ${formatUsd(usdValue)} at today's rate`
        : "No USD rate saved yet"
      : `${formatNairaFromKobo(totalKobo)} at today's rate`;

  return (
    <>
      {/* ── Telemetry Stream Bar ─────────────────────────────────────── */}
      <div className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-space-md py-space-sm mb-space-lg flex flex-wrap items-center justify-between gap-space-sm shadow-sm">
        <div className="flex items-center gap-space-sm min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
          </span>
          <span className="font-data-mono text-data-mono text-primary font-bold">
            SYSTEM STATUS: ONLINE
          </span>
          <span className="text-on-surface-variant/40 hidden sm:inline">•</span>
          <span className="font-data-mono text-data-mono text-on-surface-variant truncate">
            FARM COORDS: {weather ? `${coordLabel(weather.coords.lat, "lat")}, ${coordLabel(weather.coords.lon, "lon")}` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-space-md font-label-sm text-label-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-secondary">satellite_alt</span>
            {priceDate ? `MARKET FEED: ${formatDateHuman(priceDate)}` : "MARKET FEED: AWAITING FETCH"}
          </span>
          <span className="bg-surface-container border border-outline-variant px-2 py-0.5 rounded text-on-surface font-data-mono">
            {usdRate ? `USD ₦${usdRate.toLocaleString("en-NG", { maximumFractionDigits: 2 })}` : "USD RATE —"}
          </span>
        </div>
      </div>

      {/* ── Hero Banner ──────────────────────────────────────────────── */}
      <div className="relative bg-surface-container-lowest border border-outline-variant rounded-xl p-space-lg md:p-space-xl mb-space-lg shadow-sm overflow-hidden">
        <div className="absolute -right-8 -top-8 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-space-md">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary/10 text-primary font-label-sm text-label-sm uppercase tracking-wider mb-space-sm">
              <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                analytics
              </span>
              Harvest Valuation &amp; Execution Terminal
            </div>
            <h1 className="font-display text-display-lg-mobile sm:text-display-lg tracking-tight text-on-surface">
              Farm Overview
            </h1>
            <p className="font-headline-sm text-headline-sm text-on-surface-variant mt-1 font-normal">
              Your total crop value and best action for today.
            </p>
          </div>

          <div className="flex items-center gap-space-sm bg-surface-container-low border border-outline-variant px-4 py-2.5 rounded-lg shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">calendar_today</span>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Current Trading Cycle</span>
              <span className="font-data-mono text-data-mono text-on-surface font-bold">{tradingCycle}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Currency Toggle ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-space-md mb-space-md">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
          All figures shown in
        </span>
        <div
          className="flex items-center gap-space-xs p-1 bg-surface-container-low rounded-xl border border-outline-variant"
          role="group"
          aria-label="Currency for all figures"
        >
          <button
            type="button"
            onClick={() => setCurrency("NGN")}
            aria-pressed={currency === "NGN"}
            className={`h-9 px-space-md rounded-lg font-title-md text-title-md transition-all ${
              currency === "NGN"
                ? "bg-primary-container text-on-primary-container shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            ₦ NGN
          </button>
          <button
            type="button"
            onClick={() => setCurrency("USD")}
            aria-pressed={currency === "USD"}
            disabled={usdRate === null}
            title={usdRate === null ? "No USD rate fetched or saved yet." : undefined}
            className={`h-9 px-space-md rounded-lg font-title-md text-title-md transition-all ${
              currency === "USD"
                ? "bg-primary-container text-on-primary-container shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container-high"
            } ${usdRate === null ? "opacity-45 cursor-not-allowed" : ""}`}
          >
            $ USD
          </button>
        </div>
      </div>

      {/* ── 3 Primary Metric Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md mb-space-xl">
        {/* Card 1: Total Farm Worth */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-lg shadow-sm flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-space-sm gap-2">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
              Total Farm Worth
            </span>
          </div>
          <div className="my-space-sm">
            <div className="font-headline-lg text-[40px] leading-tight text-on-surface font-extrabold tracking-tight tabular-nums">
              {bigValue}
            </div>
            <div className="font-body-sm text-body-sm text-on-surface-variant tabular-nums">{altValue}</div>
          </div>
          <div className="pt-space-sm mt-space-sm flex items-center justify-between bg-surface-container-low border border-outline-variant rounded-lg p-2.5 gap-2">
            <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums">
              {crops.length === 0
                ? "No stock recorded yet"
                : `Aggregate ${crops.length} crop${crops.length === 1 ? "" : "s"} · ${totalKg.toLocaleString("en-NG")} kg`}
            </span>
            <span className="font-data-mono text-label-sm text-primary font-bold tabular-nums">
              {priceDate ? `AS OF ${formatDateHuman(priceDate).toUpperCase()}` : "AWAITING FETCH"}
            </span>
          </div>
        </div>

        {/* Card 2: Export Value */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-lg shadow-sm flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-space-sm gap-2">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
              Export Value
            </span>
          </div>
          <div className="my-space-sm">
            <div className="font-headline-lg text-[40px] leading-tight text-primary font-extrabold tracking-tight tabular-nums">
              {usdValue !== null ? formatUsd(usdValue) : "—"}
            </div>
            <div className="font-body-sm text-body-sm text-on-surface-variant tabular-nums">
              {usdValue !== null
                ? `${formatNairaFromKobo(totalKobo)} at today's rate`
                : usdRateDate
                  ? `No USD rate available — last saved ${formatDateHuman(usdRateDate)}`
                  : "No USD rate fetched or saved yet. It appears once the app has one."}
            </div>
          </div>
          <div className="pt-space-sm mt-space-sm flex items-center justify-between bg-surface-container-low border border-outline-variant rounded-lg p-2.5 gap-2">
            <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums">
              {usdRate ? `SPOT: 1 USD = ${formatRate(usdRate)}` : "SPOT: —"}
            </span>
            <span
              className={`font-data-mono text-label-sm font-bold ${
                usdRateOld ? "text-tertiary-strong" : "text-primary"
              }`}
              title={usdRateOld ? "Old rate — older than 7 days. It still calculates." : undefined}
            >
              {usdRateDate
                ? usdRateOld
                  ? `OLD RATE · ${formatDateHuman(usdRateDate).toUpperCase()}`
                  : `RATE OF ${formatDateHuman(usdRateDate).toUpperCase()}`
                : "NO RATE YET"}
            </span>
          </div>
        </div>

        {/* Card 3: Action Directive (real dry-day + dispatch maths) */}
        <div className="bg-tertiary/10 border border-tertiary/40 rounded-xl p-space-lg shadow-sm flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-space-sm gap-2">
            <span className="font-label-md text-label-md text-tertiary-strong font-bold uppercase tracking-wider">
              Action Directive
            </span>
            <div className="w-8 h-8 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary-strong">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {dryDay ? "thumb_up" : "rainy"}
              </span>
            </div>
          </div>

          <div className="my-space-xs">
            {weather ? (
              dryDay ? (
                <>
                  <div className="font-headline-md text-[26px] leading-tight text-on-surface font-bold tracking-tight">
                    BEST DAY TO LOAD: {weekdayLong(dryDay.date).toUpperCase()}
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    {dryDay.rainMm.toFixed(1)} mm forecast · {Math.round(dryDay.rainChancePct)}% chance · under your{" "}
                    {threshold} mm threshold.
                  </p>
                </>
              ) : (
                <>
                  <div className="font-headline-md text-[26px] leading-tight text-on-surface font-bold tracking-tight">
                    NO DRY DAY AHEAD
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Every forecast day is at or above {threshold} mm. Plan covered loading.
                  </p>
                </>
              )
            ) : (
              <>
                <div className="font-headline-md text-[26px] leading-tight text-on-surface font-bold tracking-tight">
                  WEATHER UNAVAILABLE
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {weatherError ?? "No forecast right now. The directive appears once weather data is back."}
                </p>
              </>
            )}
          </div>

          {/* Controls — real threshold + dispatch capacity */}
          <div className="mt-space-sm pt-space-sm border-t border-tertiary/30 space-y-space-sm">
            <div className="flex items-center justify-between gap-space-sm">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Rain threshold
              </span>
              <div className="flex items-center gap-1" role="group" aria-label="Rain threshold for dry-day qualification">
                {[5, 10].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setThreshold(value)}
                    aria-pressed={threshold === value}
                    className={`h-7 px-2.5 rounded border font-data-mono text-body-sm transition-colors ${
                      threshold === value
                        ? "bg-primary-container text-on-primary-container border-transparent"
                        : "bg-surface-container-lowest border-outline-variant text-on-surface"
                    }`}
                  >
                    &lt;{value}mm
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-space-sm">
              <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant" htmlFor="trucks-input">
                Dispatch capacity
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="trucks-input"
                  type="number"
                  min={1}
                  max={8}
                  step={1}
                  value={trucks}
                  onChange={(e) => setTrucks(Math.min(8, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-16 h-7 px-1.5 rounded bg-surface-container-lowest border border-outline-variant text-body-sm text-on-surface font-data-mono tabular-nums text-center"
                  aria-label="Trucks per day"
                />
                <span className="font-label-sm text-label-sm text-on-surface-variant">trucks/day ×</span>
                <select
                  value={payload}
                  onChange={(e) => setPayload(Number(e.target.value))}
                  className="h-7 px-1.5 rounded bg-surface-container-lowest border border-outline-variant text-body-sm text-on-surface font-data-mono"
                  aria-label="Truck payload in kilograms"
                >
                  <option value={100}>100kg</option>
                  <option value={250}>250kg</option>
                  <option value={500}>500kg</option>
                  <option value={1000}>1000kg</option>
                </select>
              </div>
            </div>
            <p className="font-label-sm text-label-sm text-on-surface-variant tabular-nums">
              {weather
                ? `Plan: ${trucks} × ${(trucks * payload).toLocaleString("en-NG")} kg/day · ${goDays} clear day${
                    goDays === 1 ? "" : "s"
                  } in the next ${matrix.length} at GO`
                : "Dispatch plan needs forecast data."}
            </p>
          </div>
        </div>
      </div>

      {/* ── Section Divider ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-space-md px-1">
        <div className="flex items-center gap-2">
          <span className="font-title-md text-title-md text-on-surface font-bold">
            Detailed Operational Breakdown
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container border border-outline-variant px-2 py-0.5 rounded">
            Tactical View
          </span>
        </div>
        <span className="font-label-sm text-label-sm text-on-surface-variant hidden sm:inline">
          Tap accordion cards below to inspect details
        </span>
      </div>

      {/* ── Accordions ───────────────────────────────────────────────── */}
      <div className="space-y-space-md">
        <Accordion
          icon="inventory_2"
          iconClass="bg-primary/10 text-primary"
          title="Quick Stock Breakdown"
          sub={
            crops.length === 0
              ? "No stock recorded yet"
              : `${crops.length} active commodit${crops.length === 1 ? "y" : "ies"} · ${totalKg.toLocaleString("en-NG")} kg in store`
          }
          actionLabel="Inspect Holdings"
          actionClass="text-primary"
          cta={
            <Link
              className="w-full min-h-[56px] rounded-lg bg-primary text-on-primary font-title-md text-title-md font-semibold px-space-lg flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container transition-colors text-center"
              href="/stock"
            >
              <span>Manage Full Inventory in Stock</span>
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
          }
        >
          {crops.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant p-space-md bg-surface-container-low border border-outline-variant rounded-xl">
              Nothing in store yet. Add your first crop on the Stock page and its live market value appears here.
            </p>
          ) : (
            <>
              <CropGauges crops={crops} totalKobo={totalKobo} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md mb-space-md">
                {crops.map((c) => (
                  <div
                    key={c.crop}
                    className="bg-surface-container-low border border-outline-variant rounded-xl p-space-md flex flex-col gap-1"
                  >
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      {cropLabel(c.crop)}
                    </span>
                    <span className="font-headline-md text-headline-md text-on-surface font-bold tabular-nums">
                      {formatNairaFromKobo(c.valueKobo)}
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant tabular-nums">
                      {c.qtyKg.toLocaleString("en-NG")} kg
                      {c.priceKobo !== null ? ` · ${formatNairaFromKobo(c.priceKobo)}/kg (WFP)` : " · no market price yet"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Accordion>

        <Accordion
          icon="thunderstorm"
          iconClass="bg-secondary-container/30 text-secondary"
          title="Quick Weather Status"
          sub="Microclimate sensors & load forecast"
          actionLabel="Inspect Sensors"
          actionClass="text-secondary"
          cta={
            <Link
              className="w-full min-h-[56px] rounded-lg bg-secondary text-on-secondary font-title-md text-title-md font-semibold px-space-lg flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-opacity text-center"
              href="/weather"
            >
              <span>Open 5-Day Synoptic Weather Center</span>
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
          }
        >
          {weather ? (
            <div className="bg-surface-container-low border border-outline-variant rounded-xl p-space-md mb-space-md">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-space-md mb-space-md flex flex-wrap items-center justify-between gap-space-md shadow-sm">
                <div className="flex items-center gap-space-sm min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-secondary-container/30 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[28px] text-secondary">{weatherIcon(weather.text)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-headline-md text-headline-md text-on-surface font-bold tabular-nums">
                      {Math.round(weather.tempC)}°C · {weather.text}
                    </div>
                    <div className="font-body-md text-body-md text-on-surface-variant tabular-nums">
                      Humidity {Math.round(weather.humidity)}% · Wind {Math.round(weather.windKmh)} km/h
                      {weather.pressureHpa !== null ? ` · Pressure ${Math.round(weather.pressureHpa)} hPa` : ""}
                      {weather.defaultLocation ? " · default location (Port Harcourt)" : ""}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-space-sm mb-space-md">
                <SensorTile icon="water_drop" label="Humidity" value={`${Math.round(weather.humidity)}%`} sub="current reading" />
                <SensorTile
                  icon="speed"
                  label="Pressure"
                  value={weather.pressureHpa !== null ? `${Math.round(weather.pressureHpa)} hPa` : "—"}
                  sub={weather.pressureHpa !== null ? "mean sea level" : "not reported by provider"}
                />
                <SensorTile icon="air" label="Wind" value={`${Math.round(weather.windKmh)} km/h`} sub="current speed" />
                {weather.daily[0] ? (
                  <>
                    <SensorTile
                      icon="thermostat"
                      label="Today's range"
                      value={`${Math.round(weather.daily[0].minC)}–${Math.round(weather.daily[0].maxC)}°C`}
                      sub={formatDateShort(weather.daily[0].date)}
                    />
                    <SensorTile
                      icon="Umbrella"
                      label="Rain today"
                      value={`${weather.daily[0].rainMm.toFixed(1)} mm`}
                      sub={`${Math.round(weather.daily[0].rainChancePct)}% chance`}
                    />
                  </>
                ) : null}
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-space-md shadow-sm">
                <div className="flex items-center justify-between mb-space-sm gap-2">
                  <span className="font-title-md text-title-md font-bold text-on-surface">
                    5-Day Dispatch Readiness Checklist
                  </span>
                  <span className="px-2.5 py-0.5 rounded font-label-sm text-label-sm font-semibold bg-primary/10 text-primary border border-primary/30">
                    {goDays}/{matrix.length} GO
                  </span>
                </div>
                <div className="space-y-space-sm">
                  {matrix.map((day) => (
                    <div key={day.date} className="flex items-start justify-between gap-space-sm">
                      <div className="min-w-0">
                        <div className="font-body-md text-body-md text-on-surface font-semibold">
                          {formatDateShort(day.date)}
                        </div>
                        <div className="font-body-sm text-body-sm text-on-surface-variant truncate">{day.reason}</div>
                      </div>
                      <span className={flagChip[day.flag]}>{day.flag}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="font-body-md text-body-md text-on-surface-variant p-space-md bg-surface-container-low border border-outline-variant rounded-xl mb-space-md">
              {weatherError ?? "Weather is unavailable right now. Sensors reappear once the forecast feed answers."}
            </p>
          )}
        </Accordion>
      </div>

      {/* ── Forecast Basis panel ─────────────────────────────────────── */}
      <section aria-label="Forecast basis" className="mt-space-xl bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-space-md">
        <div className="flex items-center justify-between mb-space-sm">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-secondary text-[20px]">calendar_month</span>
            <h2 className="font-title-md text-title-md text-on-surface font-bold">
              {weather && weather.daily.length > 0 ? `${weather.daily.length}-Day Forecast Basis` : "Forecast Basis"}
            </h2>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Days meeting your &lt;{threshold} mm threshold are marked dry
          </span>
        </div>
        {weather && weather.daily.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-body-md text-body-md border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest border-b border-outline-variant text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th scope="col" className="py-space-sm px-space-md rounded-l-lg font-bold">Day</th>
                  <th scope="col" className="py-space-sm px-space-md font-bold">Date</th>
                  <th scope="col" className="py-space-sm px-space-md font-bold text-right">Rain</th>
                  <th scope="col" className="py-space-sm px-space-md font-bold text-right">Low</th>
                  <th scope="col" className="py-space-sm px-space-md font-bold text-right">High</th>
                  <th scope="col" className="py-space-sm px-space-md font-bold text-right">Chance</th>
                  <th scope="col" className="py-space-sm px-space-md rounded-r-lg font-bold text-center">Verdict</th>
                </tr>
              </thead>
              <tbody className="text-on-surface">
                {weather.daily.map((day, index) => {
                  const verdict = matrix[index];
                  return (
                    <tr key={day.date} className="border-b border-outline-variant/60 last:border-b-0">
                      <td className="py-space-sm px-space-md font-semibold">{weekdayLong(day.date).slice(0, 3)}</td>
                      <td className="py-space-sm px-space-md tabular-nums">{formatDateShort(day.date).slice(4)}</td>
                      <td className="py-space-sm px-space-md text-right tabular-nums">{day.rainMm.toFixed(1)} mm</td>
                      <td className="py-space-sm px-space-md text-right tabular-nums">{Math.round(day.minC)}°C</td>
                      <td className="py-space-sm px-space-md text-right tabular-nums">{Math.round(day.maxC)}°C</td>
                      <td className="py-space-sm px-space-md text-right tabular-nums">{Math.round(day.rainChancePct)}%</td>
                      <td className="py-space-sm px-space-md text-center">
                        {verdict ? (
                          <span className={flagChip[verdict.flag]} title={verdict.reason}>
                            {day.rainMm < threshold ? "DRY" : verdict.flag}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-body-md text-body-md text-on-surface-variant py-space-md">
            {weatherError ?? "No forecast available right now."}
          </p>
        )}
      </section>
    </>
  );
}

/* ── Accordion (prototype structure) ─────────────────────────────────── */

function Accordion({
  icon,
  iconClass,
  title,
  sub,
  actionLabel,
  actionClass,
  cta,
  children,
}: {
  icon: string;
  iconClass: string;
  title: string;
  sub: string;
  actionLabel: string;
  actionClass: string;
  cta: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden transition-all duration-300">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="w-full min-h-[56px] px-space-md py-space-sm bg-surface-container-lowest hover:bg-surface-container-low text-left flex items-center justify-between gap-space-md transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-space-sm min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-title-md text-title-md text-on-surface font-semibold truncate">{title}</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{sub}</span>
          </div>
        </div>
        <div className="flex items-center gap-space-sm shrink-0">
          <span className={`font-label-sm text-label-sm font-semibold hidden md:inline ${actionClass}`}>{actionLabel}</span>
          <div
            className={`w-8 h-8 rounded-lg bg-surface-container border border-outline-variant flex items-center justify-center text-on-surface transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          >
            <span className="material-symbols-outlined text-[20px]">expand_more</span>
          </div>
        </div>
      </button>
      <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="p-space-md pt-0 bg-surface-container-lowest">
            {children}
            {cta}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Crop share gauges ───────────────────────────────────────────────── */

function CropGauges({ crops, totalKobo }: { crops: OverviewCrop[]; totalKobo: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = crops.find((c) => c.crop === selected) ?? null;

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-space-md mb-space-md">
      <div className="flex items-center justify-between mb-space-sm">
        <span className="font-title-md text-title-md text-on-surface font-bold">Stock Share Gauges</span>
        <span className="font-label-sm text-label-sm text-on-surface-variant">Tap a crop to inspect its lots</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        {crops.map((c) => {
          const share = totalKobo > 0 ? c.valueKobo / totalKobo : 0;
          const pct = Math.round(share * 100);
          return (
            <button
              key={c.crop}
              type="button"
              onClick={() => setSelected((value) => (value === c.crop ? null : c.crop))}
              aria-pressed={selected === c.crop}
              className={`flex items-center gap-space-md p-space-md rounded-xl border text-left transition-colors ${
                selected === c.crop
                  ? "bg-primary/5 border-primary/40"
                  : "bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              <svg viewBox="0 0 80 80" className="w-16 h-16 shrink-0" role="img" aria-label={`${pct}% of stock value`}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgb(var(--outline-variant))" strokeWidth="8" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="rgb(var(--primary-container))"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${share * 213.6} 213.6`}
                  transform="rotate(-90 40 40)"
                />
                <text x="40" y="44" textAnchor="middle" className="chart-axis" style={{ fontSize: 16, fontWeight: 700 }}>
                  {pct}%
                </text>
              </svg>
              <div className="min-w-0">
                <div className="font-title-md text-title-md text-on-surface font-semibold truncate">{cropLabel(c.crop)}</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant tabular-nums truncate">
                  {c.qtyKg.toLocaleString("en-NG")} kg · {formatNairaFromKobo(c.valueKobo)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {active ? (
        <div className="mt-space-md bg-surface-container-lowest border border-outline-variant rounded-lg p-space-md">
          <span className="font-title-md text-title-md text-on-surface font-bold">{cropLabel(active.crop)} — lots</span>
          <ul className="mt-2 space-y-1">
            {active.lots.map((lot, index) => (
              <li key={index} className="flex items-center justify-between gap-space-sm font-body-md text-body-md">
                <span className="text-on-surface tabular-nums">{lot.qtyKg.toLocaleString("en-NG")} kg</span>
                <span className="text-on-surface-variant truncate">
                  {lot.note ? lot.note : `Lot ${index + 1}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ── Sensor tile ─────────────────────────────────────────────────────── */

function SensorTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-space-sm">
      <div className="flex items-start justify-between gap-1">
        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{label}</span>
        <span className="w-7 h-7 rounded bg-secondary-container/30 flex items-center justify-center text-secondary shrink-0">
          <span className="material-symbols-outlined text-[16px]">{icon}</span>
        </span>
      </div>
      <div className="font-headline-md text-headline-md text-on-surface font-bold mt-1 tabular-nums">{value}</div>
      <div className="font-label-sm text-label-sm text-on-surface-variant">{sub}</div>
    </div>
  );
}
