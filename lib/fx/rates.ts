// FX pure logic (04-croptrade.md).
// Rate meaning is fixed everywhere: "1 foreign = X local" (e.g. 1 USD = 1,500 NGN).
// The live source is USD-based, so localPerForeign = rates[local] / rates[foreign].

import { z } from "zod";
import { FX_OLD_RATE_DAYS } from "../config";

export { FX_OLD_RATE_DAYS };

/** Free, no-key, USD-based endpoint (terms: attribution required, no redistribution). */
export const FX_SOURCE_URL = "https://open.er-api.com/v6/latest/USD";
export const FX_ATTRIBUTION = { label: "Rates By Exchange Rate API", url: "https://www.exchangerate-api.com" };

/** open.er-api.com success shape (verified 2026-10): https://open.er-api.com/v6/latest/USD */
export const openEraSchema = z.object({
  result: z.literal("success"),
  base_code: z.literal("USD"),
  rates: z.record(z.number()),
  time_last_update_utc: z.string().optional(),
  time_last_update_unix: z.number().optional(),
});
export type OpenEraResponse = z.infer<typeof openEraSchema>;

/**
 * Cross rate from a USD-based table. localPerForeign = rates[local] / rates[foreign],
 * meaning "1 foreign = X local". Throws a one-sentence error when a rate is missing.
 */
export function crossRate(
  usdTable: Record<string, number>,
  local: string,
  foreign: string
): number {
  const localRate = usdTable[local];
  const foreignRate = usdTable[foreign];
  if (!localRate || !foreignRate || localRate <= 0 || foreignRate <= 0) {
    throw new Error(`No rate available for ${foreign} against ${local}.`);
  }
  const rate = localRate / foreignRate;
  return Math.round(rate * 10_000) / 10_000;
}

/** True when a saved rate is more than FX_OLD_RATE_DAYS old (still calculates, but tagged). */
export function isOldRate(dateIso: string, todayIso: string): boolean {
  const d = Date.parse(dateIso + "T00:00:00Z");
  const t = Date.parse(todayIso + "T00:00:00Z");
  if (Number.isNaN(d) || Number.isNaN(t)) return false;
  return Math.round((t - d) / 86_400_000) > FX_OLD_RATE_DAYS;
}
