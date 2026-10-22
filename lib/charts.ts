// Chart data helpers (step 5) — pure functions shared by the server pages and the
// client charts. Everything returned is plain JSON, so it can cross the
// server → client boundary.
// Rules from design.md §4: colour-blind safe palette, max 6 series, pie max 5 slices
// (the rest grouped as "Other"). A day with no saved value is a GAP (null) — the
// charts never invent a number.

import { addDaysIso } from "./time";

/** Colour-blind safe series colours (design.md §4). */
export const SERIES_COLORS = [
  "#0072B2",
  "#E69F00",
  "#009E73",
  "#D55E00",
  "#CC79A7",
  "#56B4E9",
] as const;

/** Max series on one chart (design.md §4). */
export const MAX_SERIES = SERIES_COLORS.length;
/** Max pie slices including "Other" (design.md §4). */
export const MAX_PIE_SLICES = 5;
export const OTHER_LABEL = "Other";

export const MAX_CHART_DAYS = 90;

function clampDays(days: number, max = MAX_CHART_DAYS): number {
  if (!Number.isFinite(days)) return 1;
  return Math.min(max, Math.max(1, Math.floor(days)));
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

// ---------- stock value by crop ----------

export interface StockValueSlice {
  crop: string;
  label: string;
  /** Integer kobo. */
  valueKobo: number;
}

/**
 * Stock value per crop for the bar chart. Rows are aggregated by crop, crops with
 * no value (no price yet, or zero kg) are left out, and the biggest value comes
 * first so the chart reads top-down.
 */
export function stockValueByCrop(
  items: readonly { crop: string; qtyKg: number; priceKobo: number }[],
  labelFor: (crop: string) => string
): StockValueSlice[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (!positive(item.qtyKg) || !Number.isFinite(item.priceKobo)) continue;
    const value = Math.round(item.qtyKg * item.priceKobo);
    if (value <= 0) continue;
    totals.set(item.crop, (totals.get(item.crop) ?? 0) + value);
  }
  return [...totals.entries()]
    .map(([crop, valueKobo]) => ({ crop, label: labelFor(crop), valueKobo }))
    .sort((a, b) => b.valueKobo - a.valueKobo || a.label.localeCompare(b.label));
}

export interface PieSlice {
  name: string;
  /** Integer kobo. */
  valueKobo: number;
}

/**
 * Pie data: at most `max` slices. Beyond that the biggest `max - 1` stay and the
 * rest are summed into "Other" — never dropped silently.
 */
export function pieSlices(
  slices: readonly StockValueSlice[],
  max = MAX_PIE_SLICES
): PieSlice[] {
  const limit = Math.max(2, Math.floor(max));
  if (slices.length === 0) return [];
  if (slices.length <= limit) {
    return slices.map((slice) => ({ name: slice.label, valueKobo: slice.valueKobo }));
  }
  const kept = slices
    .slice(0, limit - 1)
    .map((slice) => ({ name: slice.label, valueKobo: slice.valueKobo }));
  const other = slices
    .slice(limit - 1)
    .reduce((sum, slice) => sum + slice.valueKobo, 0);
  return [...kept, { name: OTHER_LABEL, valueKobo: other }];
}

// ---------- rate history (gaps stay gaps) ----------

export interface RateHistoryRow {
  date: string; // YYYY-MM-DD
  localPerForeign: number;
  source: string; // LIVE | SIMULATED | MANUAL
}

export interface RatePoint {
  date: string;
  /** null → no rate saved that day (drawn as a gap, table says "No data"). */
  rate: number | null;
  source: string | null;
}

export interface RateOverride {
  date: string;
  localPerForeign: number;
  source: string;
}

/**
 * One point per day for the last `days` days, oldest first.
 * - a day without a saved rate is `rate: null` (a gap)
 * - `current` is the effective rate today (live, saved or manual); it is placed on
 *   its own day so a live rate that has not been persisted yet still shows
 * - a MANUAL rate applies from the day it was set until it is cleared
 */
export function rateSeries(
  history: readonly RateHistoryRow[],
  opts: { days: number; today: string; current?: RateOverride | null }
): RatePoint[] {
  const days = clampDays(opts.days);
  const saved = new Map(history.map((row) => [row.date, row]));
  const current =
    opts.current && positive(opts.current.localPerForeign) ? opts.current : null;
  const points: RatePoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysIso(opts.today, -i);
    const row = saved.get(date);
    let rate = row && positive(row.localPerForeign) ? row.localPerForeign : null;
    let source = rate === null ? null : (row?.source ?? null);

    if (current) {
      if (current.source === "MANUAL" && date >= current.date) {
        rate = current.localPerForeign;
        source = "MANUAL";
      } else if (current.date === date) {
        rate = current.localPerForeign;
        source = current.source;
      }
    }
    points.push({ date, rate, source });
  }
  return points;
}

// ---------- market price history ----------

export interface PriceHistoryRow {
  date: string;
  priceKobo: number;
}

export interface PricePoint {
  date: string;
  /** null → no price saved that day (gap). */
  priceKobo: number | null;
}

/** One point per day for the last `days` days, oldest first; missing days are gaps. */
export function priceSeries(
  history: readonly PriceHistoryRow[],
  opts: { days: number; today: string }
): PricePoint[] {
  const days = clampDays(opts.days);
  const saved = new Map(history.map((row) => [row.date, row]));
  const points: PricePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysIso(opts.today, -i);
    const row = saved.get(date);
    points.push({
      date,
      priceKobo: row && positive(row.priceKobo) ? row.priceKobo : null,
    });
  }
  return points;
}

// ---------- saved valuations ----------

export interface ValuationBarInput {
  id: string;
  crop: string;
  quote: string;
  netForeign: number;
  date: string;
}

export interface ValuationBar {
  id: string;
  crop: string;
  label: string;
  quote: string;
  netForeign: number;
  date: string;
}

/**
 * Bars for saved valuations, oldest first (a bar chart reads left to right in time).
 * Broken or non-positive amounts are left out instead of drawing a false bar.
 */
export function valuationBars(
  rows: readonly ValuationBarInput[],
  labelFor: (crop: string) => string
): ValuationBar[] {
  return rows
    .filter((row) => positive(row.netForeign))
    .map((row) => ({
      id: row.id,
      crop: row.crop,
      label: labelFor(row.crop),
      quote: row.quote,
      netForeign: row.netForeign,
      date: row.date,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

// ---------- labels and units ----------

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-10-19" → "19 Oct". Kept dependency-free for the client bundle. */
export function shortDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const month = MONTHS[Number(parts[1]) - 1];
  return month ? `${Number(parts[2])} ${month}` : iso;
}

/** "2026-10-19" → "19 Oct 2026". */
export function longDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const month = MONTHS[Number(parts[1]) - 1];
  return month ? `${Number(parts[2])} ${month} ${parts[0]}` : iso;
}

/** 1500 → "₦1.5k", 1_500_000 → "₦1.5m" (axis ticks). */
export function compactNaira(naira: number): string {
  return `₦${compactNumber(naira)}`;
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", NGN: "₦" };

export function currencySymbol(quote: string): string {
  return CURRENCY_SYMBOLS[quote] ?? `${quote} `;
}

/** 1500 USD → "$1.5k" (axis ticks). */
export function compactMoney(amount: number, quote: string): string {
  return `${currencySymbol(quote)}${compactNumber(amount)}`;
}

function compactNumber(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}m`;
  if (abs >= 1_000) return `${trim(value / 1_000)}k`;
  return String(Math.round(value));
}

const whole = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Naira amount → "₦150,000". */
export function naira(amount: number): string {
  return `₦${whole.format(amount)}`;
}

/** Naira amount with kobo → "₦1,500.25" (exchange rates). */
export function nairaExact(amount: number): string {
  return `₦${exact.format(amount)}`;
}

/** Foreign amount with its symbol → "$100.00", "€50.00", "£1,200.00". */
export function money(amount: number, quote: string): string {
  const number = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currencySymbol(quote)}${number}`;
}

/** Plain word for a stored data source (never colour alone — design.md §1). */
export function sourceWord(source: string | null): string {
  switch (source) {
    case "LIVE":
      return "Live";
    case "MANUAL":
      return "Manual";
    case "SAVED":
      return "Saved data";
    default:
      return "No data";
  }
}
