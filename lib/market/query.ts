// Query validation for /api/market/history — Zod on every server input (00-global §2).
// Bad input returns one sentence saying what to fix.

import { z } from "zod";
import { getCatalogEntry } from "./catalog";

export const HISTORY_DEFAULT_DAYS = 30;
export const HISTORY_MAX_DAYS = 90;

const daysSchema = z.coerce.number().int().min(1).max(HISTORY_MAX_DAYS);

export type HistoryParams =
  | { ok: true; crop: string; days: number }
  | { ok: false; error: string };

export function parseHistoryParams(params: URLSearchParams): HistoryParams {
  const crop = params.get("crop");
  if (!crop) {
    return { ok: false, error: "Add a crop, for example ?crop=MAIZE." };
  }
  if (!getCatalogEntry(crop)) {
    return {
      ok: false,
      error: `Unknown crop "${crop}". Check /api/market/prices for the crop list.`,
    };
  }
  const rawDays = params.get("days") ?? String(HISTORY_DEFAULT_DAYS);
  const parsed = daysSchema.safeParse(rawDays);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Days must be a whole number from 1 to ${HISTORY_MAX_DAYS}.`,
    };
  }
  return { ok: true, crop, days: parsed.data };
}
