// Corridor rates beyond the app's USD/EUR/GBP trio (server only).
//
// The converter promises GHS, KES, ZAR and XOF "with the corridor". Those come
// from the same free, no-key endpoint the Rates page already uses — cross-rated
// live against the naira table. There is deliberately no fallback list: when the
// provider is unreachable this returns an empty array, the converter simply
// offers fewer currencies, and USD/EUR/GBP keep working through the normal
// saved-rate path in lib/fx/service.ts.

import { fetchJson, type FetchLike } from "../server/http";
import { crossRate, openEraSchema, FX_SOURCE_URL } from "../fx/rates";
import { todayIso } from "../time";

/** Currencies the converter corridor ships with, beyond FX_QUOTES. */
export const CORRIDOR_QUOTES = ["GHS", "KES", "ZAR", "XOF"] as const;
export type CorridorQuote = (typeof CORRIDOR_QUOTES)[number];

export interface CorridorRow {
  quote: string;
  localPerForeign: number;
  date: string; // YYYY-MM-DD
}

/** 6-hour cache — same lifetime the main FX service uses. */
const CORRIDOR_CACHE_MS = 6 * 60 * 60 * 1000;

let cache: { at: number; rows: CorridorRow[] } | null = null;

/** Test hook. */
export function __resetCorridorCache(): void {
  cache = null;
}

/**
 * Live 1-unit-of-X-in-naira for each corridor currency. Resolves to [] when the
 * provider fails or a code is missing from its table — the caller then shows
 * only what exists, never a made-up rate.
 */
export async function corridorRates(
  opts: { fetchImpl?: FetchLike; now?: Date } = {}
): Promise<CorridorRow[]> {
  const now = opts.now ?? new Date();
  if (cache && now.getTime() - cache.at < CORRIDOR_CACHE_MS) return cache.rows;

  try {
    const json = openEraSchema.parse(await fetchJson<unknown>(FX_SOURCE_URL, { fetchImpl: opts.fetchImpl }));
    const rows: CorridorRow[] = [];
    for (const quote of CORRIDOR_QUOTES) {
      try {
        rows.push({
          quote,
          localPerForeign: crossRate(json.rates, "NGN", quote),
          date: todayIso(now),
        });
      } catch {
        // This code is missing from the provider's table — skip it, keep the rest.
      }
    }
    cache = { at: now.getTime(), rows };
    return rows;
  } catch {
    return [];
  }
}
