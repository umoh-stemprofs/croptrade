// Manual exchange rates are PRIVATE to one farm (04-croptrade.md).
// They are never written to the shared FxTick table: the effective rate for a farm is
// its ManualRate if one is set (badge "Manual"), otherwise the latest shared
// live/saved/simulated rate from FxTick.
// Rate meaning is fixed everywhere: "1 foreign = X local" (e.g. 1 USD = 1,500 NGN).

import { z } from "zod";
import { FX_QUOTES } from "../config";
import { isOldRate } from "./rates";
import type { FxRateView } from "./service";

export const manualRateSchema = z.object({
  quote: z.enum(FX_QUOTES, {
    errorMap: () => ({ message: "Choose USD, EUR or GBP." }),
  }),
  localPerForeign: z
    .number({ invalid_type_error: "Enter the rate as a number." })
    .finite("Enter the rate as a number.")
    .positive("The rate must be above 0."),
});
export type ManualRateInput = z.infer<typeof manualRateSchema>;

/** One saved override, exactly as it comes out of ManualRate. */
export interface ManualRateRow {
  quote: string;
  localPerForeign: number;
  /** YYYY-MM-DD — the day the farmer set it (used for the Old rate tag). */
  setOn: string;
}

/**
 * Effective rates for one farm: a manual rate replaces the shared rate for that
 * currency. Other farms pass their own manual rows, so one farm's override can
 * never change another farm's rate.
 */
export function mergeManualRates(
  base: FxRateView[],
  manual: readonly ManualRateRow[],
  today: string
): FxRateView[] {
  const byQuote = new Map(base.map((row) => [row.quote, row]));
  for (const row of manual) {
    byQuote.set(row.quote, {
      quote: row.quote,
      localPerForeign: row.localPerForeign,
      date: row.setOn,
      source: "MANUAL",
      old: isOldRate(row.setOn, today),
      live: false,
    });
  }
  // Stable USD, EUR, GBP order; unknown quotes are ignored.
  return FX_QUOTES.filter((quote) => byQuote.has(quote)).map((quote) => byQuote.get(quote)!);
}
