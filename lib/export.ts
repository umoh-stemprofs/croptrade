// Export value logic (04-croptrade.md §Logic) — pure functions, no I/O, never throws.
// Money: integer kobo (₦1 = 100 kobo, 00-global §2).
// Rate meaning is fixed everywhere: "1 foreign = X local" (e.g. 1 USD = 1,500 NGN).
// Days numbers live in /lib/config.ts (FX_OLD_RATE_DAYS, FX_HISTORY_DAYS).

import { FX_HISTORY_DAYS } from "./config";
import { isOldRate } from "./fx/rates";

export interface ExportInput {
  quote: string; // "USD" | "EUR" | "GBP"
  qtyKg: number; // stock weight in kg (> 0)
  localPricePerKgKobo: number; // local price per kg in kobo (₦600 → 60000)
  /** "1 foreign = X local". Missing → the page should send the user to the Rates page. */
  localPerForeign?: number | null;
  /** YYYY-MM-DD of the rate, for the "Old rate" flag (it still calculates). */
  rateDate?: string | null;
  exportCostPct: number; // 0..100
  today: string; // YYYY-MM-DD in APP_TZ
}

export type ExportResult =
  | { ok: false; kind: "invalid"; error: string }
  | { ok: false; kind: "no-rate"; error: string; quote: string }
  | {
      ok: true;
      quote: string;
      /** qtyKg × localPricePerKg — integer kobo. */
      totalLocalKobo: number;
      /** totalLocal ÷ localPerForeign — foreign currency, 2 decimals. */
      grossForeign: number;
      /** gross × (1 − exportCostPct/100) — foreign currency, 2 decimals. */
      netForeign: number;
      /** rate older than FX_OLD_RATE_DAYS — still calculates, page shows the tag. */
      oldRate: boolean;
    };

const round2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * What the crop is worth abroad. One plain sentence per problem, no throws:
 * qty > 0, rate > 0 (missing rate → no-rate so the page can link to the Rates page),
 * exportCostPct 0–100.
 */
export function exportValue(input: ExportInput): ExportResult {
  const { quote, qtyKg, localPricePerKgKobo, exportCostPct, today } = input;

  if (!Number.isFinite(qtyKg) || qtyKg <= 0) {
    return {
      ok: false,
      kind: "invalid",
      error: "Quantity must be more than 0 kg. Enter a kg amount above zero.",
    };
  }
  if (!Number.isFinite(exportCostPct) || exportCostPct < 0 || exportCostPct > 100) {
    return {
      ok: false,
      kind: "invalid",
      error: "Export cost must be a percentage from 0 to 100.",
    };
  }
  if (input.localPerForeign === null || input.localPerForeign === undefined) {
    return {
      ok: false,
      kind: "no-rate",
      quote,
      error: `No rate saved for ${quote} yet. Set it on the Rates page.`,
    };
  }
  if (!Number.isFinite(input.localPerForeign) || input.localPerForeign <= 0) {
    return {
      ok: false,
      kind: "invalid",
      error: "The exchange rate must be above 0. Set a rate on the Rates page.",
    };
  }

  const totalLocalKobo = Math.round(qtyKg * localPricePerKgKobo);
  const grossForeign = round2(totalLocalKobo / 100 / input.localPerForeign);
  const netForeign = round2(grossForeign * (1 - exportCostPct / 100));
  const oldRate = input.rateDate ? isOldRate(input.rateDate, today) : false;

  return { ok: true, quote, totalLocalKobo, grossForeign, netForeign, oldRate };
}

/**
 * Best-rate advice (04-croptrade.md): today's rate against the highest rate of the
 * last FX_HISTORY_DAYS days, e.g. "Today's rate is 3% below the 30-day best."
 * `previousRates` = the rates of the last 30 days BEFORE today, in any order.
 */
export function bestRateAdvice(todayRate: number, previousRates: readonly number[]): string {
  if (previousRates.length === 0) {
    return `No ${FX_HISTORY_DAYS}-day rate history yet — today is the first rate.`;
  }
  if (!Number.isFinite(todayRate) || todayRate <= 0) {
    return "No rate for today yet.";
  }
  const best = Math.max(...previousRates.filter((r) => Number.isFinite(r) && r > 0));
  if (!Number.isFinite(best)) {
    return `No ${FX_HISTORY_DAYS}-day rate history yet — today is the first rate.`;
  }
  if (todayRate >= best) {
    return `Today's rate is the best of the last ${FX_HISTORY_DAYS} days.`;
  }
  const pct = Math.round(((best - todayRate) / best) * 100);
  if (pct === 0) {
    return `Today's rate is about the same as the ${FX_HISTORY_DAYS}-day best.`;
  }
  return `Today's rate is ${pct}% below the ${FX_HISTORY_DAYS}-day best.`;
}
