// Slices a price series to a "last N days" window using each point's own date —
// the timestamp the survey reported — never a point count. A crop with only three
// reported dates must still lose the old ones when the range shrinks, otherwise
// "last 7 days" would silently show three months.
//
// The window is anchored on the crop's newest record rather than today, so a crop
// that was surveyed earlier than the rest of the market still charts its recent
// history instead of going blank.

const DAY_MS = 86_400_000;

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.POSITIVE_INFINITY;
  return Math.round((to - from) / DAY_MS);
}

/**
 * Keeps the points whose date falls within `[anchor − rangeDays, anchor]`,
 * preserving order. Points newer than the anchor (impossible in a correctly
 * built series) and points with unparseable dates are dropped, never guessed at.
 */
export function windowSeries<T extends { date: string }>(
  points: T[],
  anchorIso: string,
  rangeDays: number
): T[] {
  return points.filter((point) => {
    const age = daysBetween(point.date, anchorIso);
    return age >= 0 && age <= rangeDays;
  });
}

/** Whole days from the first to the last point — the span actually shown. */
export function seriesSpanDays<T extends { date: string }>(points: T[]): number {
  if (points.length < 2) return 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const span = daysBetween(first.date, last.date);
  return Number.isFinite(span) ? span : 0;
}
