// Date helpers. All dates "YYYY-MM-DD" in APP_TZ — never the server clock zone (00-global §2).

import { formatInTimeZone } from "date-fns-tz";
import { APP_TZ } from "./config";

/** Today's date in APP_TZ as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return formatInTimeZone(now, APP_TZ, "yyyy-MM-dd");
}

/** Add whole days to a YYYY-MM-DD string (pure, UTC-safe for date-only values). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD strings (b - a). */
export function daysBetweenIso(a: string, b: string): number {
  const da = Date.parse(a + "T00:00:00Z");
  const db = Date.parse(b + "T00:00:00Z");
  if (Number.isNaN(da) || Number.isNaN(db)) {
    throw new Error(`Invalid date ("${a}", "${b}") — expected YYYY-MM-DD.`);
  }
  return Math.round((db - da) / 86_400_000);
}
