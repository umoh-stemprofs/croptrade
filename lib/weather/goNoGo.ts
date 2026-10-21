// Dispatch readiness flags for the 5-day matrix (S-WEATHER) — pure logic.
//
// Every flag is derived from real forecast numbers the caller fetched: rainfall
// volume, rain probability, and the day's steepest 3-hour barometric fall. The
// thresholds are operational rules, not data:
//   • NO-GO  — the prototype's stated pre-dispatch lock (barometric drop greater
//     than 4.5 hPa in 3 h), heavy rain (≥ 15 mm), a stormy chance (≥ 80%), or a
//     wet day that fails the app's own dry-loading rule (≥ 5 mm).
//   • CAUTION — moderate rain (≥ 5 mm) or a rising storm chance (≥ 50%) or a
//     noticeable pressure fall (> 2 hPa in 3 h).
//   • GO     — everything else.
// When barometric data is missing the flag still works from rainfall and the
// reason says the pressure trend was unavailable — never a silent invented value.

import type { WeatherDay } from "./types";

export type DispatchFlag = "GO" | "CAUTION" | "NO-GO";

/** Steepest 3-hour pressure fall for one forecast day, in hPa (null when unknown). */
export interface DayBarometric {
  date: string; // YYYY-MM-DD
  /** Largest drop over any 3-hour window that day; positive = pressure falling. */
  drop3hMax: number | null;
  /** Mean surface pressure for the day, hPa. */
  meanHpa: number | null;
}

export interface DispatchStatus {
  date: string;
  flag: DispatchFlag;
  /** One short sentence naming the numbers behind the flag. */
  reason: string;
  rainMm: number;
  rainChancePct: number;
  /** hPa fall in the steepest 3-hour window; null when pressure data is missing. */
  drop3h: number | null;
  /** True when this day could not be judged on pressure — rainfall only. */
  pressureUnknown: boolean;
}

export const DISPATCH_THRESHOLDS = {
  /** The dry-loading rule already used by the loading-window card. */
  dryMm: 5,
  heavyMm: 15,
  stormChancePct: 80,
  risingChancePct: 50,
  /** Pre-dispatch protocol lock from the design spec. */
  lockDropHpa: 4.5,
  cautionDropHpa: 2,
} as const;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Derive one day's flag. `barometric` may be null when pressure data is missing. */
export function dispatchStatusFor(
  day: WeatherDay,
  barometric: DayBarometric | null
): DispatchStatus {
  const drop3h = barometric?.drop3hMax ?? null;
  const pressureUnknown = drop3h === null;
  const rainMm = day.rainMm;
  const chance = day.rainChancePct;

  const base = {
    date: day.date,
    rainMm,
    rainChancePct: chance,
    drop3h,
    pressureUnknown,
  };

  const pressurePart = pressureUnknown
    ? "pressure trend unavailable"
    : `pressure fell ${round1(drop3h!)} hPa/3h`;

  // NO-GO first: any lock condition is decisive.
  if (pressureUnknown === false && drop3h! > DISPATCH_THRESHOLDS.lockDropHpa) {
    return {
      ...base,
      flag: "NO-GO",
      reason: `Barometric lock: ${pressurePart} (limit ${DISPATCH_THRESHOLDS.lockDropHpa} hPa/3h).`,
    };
  }
  if (rainMm >= DISPATCH_THRESHOLDS.heavyMm) {
    return {
      ...base,
      flag: "NO-GO",
      reason: `${round1(rainMm)} mm forecast with ${Math.round(chance)}% chance — ${pressurePart}.`,
    };
  }
  if (chance >= DISPATCH_THRESHOLDS.stormChancePct) {
    return {
      ...base,
      flag: "NO-GO",
      reason: `${Math.round(chance)}% rain chance on a wet day (${round1(rainMm)} mm) — ${pressurePart}.`,
    };
  }
  if (rainMm >= DISPATCH_THRESHOLDS.dryMm) {
    return {
      ...base,
      flag: "NO-GO",
      reason: `${round1(rainMm)} mm breaks the ${DISPATCH_THRESHOLDS.dryMm} mm dry-loading rule — ${pressurePart}.`,
    };
  }

  // CAUTION: watch the middle band.
  if (pressureUnknown === false && drop3h! > DISPATCH_THRESHOLDS.cautionDropHpa) {
    return {
      ...base,
      flag: "CAUTION",
      reason: `${pressurePart} — watch before dispatch.`,
    };
  }
  if (chance >= DISPATCH_THRESHOLDS.risingChancePct || rainMm > 0) {
    return {
      ...base,
      flag: "CAUTION",
      reason: `Rain possible: ${Math.round(chance)}% chance, ${round1(rainMm)} mm — ${pressurePart}.`,
    };
  }

  return {
    ...base,
    flag: "GO",
    reason: `Dry (${round1(rainMm)} mm, ${Math.round(chance)}%) and ${pressureUnknown ? "pressure unknown" : `pressure ${round1(drop3h!) <= 0 ? "steady or rising" : `steady (${pressurePart})`}`}.`,
  };
}

/** Flags for all forecast days, aligned by date (missing pressure = null). */
export function dispatchMatrix(
  days: readonly WeatherDay[],
  barometric: readonly DayBarometric[]
): DispatchStatus[] {
  const byDate = new Map(barometric.map((entry) => [entry.date, entry]));
  return days.map((day) => dispatchStatusFor(day, byDate.get(day.date) ?? null));
}
