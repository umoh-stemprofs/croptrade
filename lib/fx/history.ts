// Shared FX history (FxTick) for the Rates page table and the best-rate advice.
// LIVE ticks only: simulated rows are no longer seeded (prisma/seed.ts purges them)
// and reads filter them out too, so only real open.er-api.com pulls feed the
// 30-day chart. Manual overrides live in ManualRate and never enter FxTick.

import { prisma } from "../db";
import { FX_HISTORY_DAYS } from "../config";
import { addDaysIso } from "../time";

export interface FxHistoryRow {
  date: string; // YYYY-MM-DD
  localPerForeign: number;
  source: string;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The last `days` saved LIVE rates for a currency, newest first (Rates page table). */
export async function fxHistory(quote: string, days = FX_HISTORY_DAYS): Promise<FxHistoryRow[]> {
  const rows = await prisma.fxTick.findMany({
    where: { quote, source: "LIVE" },
    orderBy: { date: "desc" },
    take: days,
  });
  return rows.map((row) => ({
    date: isoDay(row.date),
    localPerForeign: row.localPerForeign,
    source: row.source,
  }));
}

/**
 * Rates of the `days` days BEFORE today (best-rate advice), LIVE ticks only. Empty
 * when there is no live history yet — bestRateAdvice then says so instead of crashing.
 */
export async function previousRates(
  quote: string,
  today: string,
  days = FX_HISTORY_DAYS
): Promise<number[]> {
  const rows = await prisma.fxTick.findMany({
    where: { quote, source: "LIVE", date: { gte: new Date(addDaysIso(today, -days) + "T00:00:00Z"), lt: new Date(today + "T00:00:00Z") } },
    orderBy: { date: "asc" },
  });
  return rows.map((row) => row.localPerForeign);
}
