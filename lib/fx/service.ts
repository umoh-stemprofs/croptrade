// FX service (server only, 04-croptrade.md):
// - live source open.er-api.com (USD-based, no key), Zod-validated, 6-hour in-memory cache
// - localPerForeign = rates[NGN] / rates[quote], meaning "1 foreign = X local"
// - on success, save each rate to FxTick as LIVE (never overwriting MANUAL — see store.ts)
// - if the call fails, use the last saved rate with the "Saved data" badge
// - a saved rate older than 7 days also gets the "Old rate" tag; it still calculates
// - if there is no rate and no saved data: one-sentence error, no crash

import { FX_QUOTES, type FxQuote } from "../config";
import { addDaysIso, todayIso } from "../time";
import { fetchJson, type FetchLike } from "../server/http";
import { crossRate, isOldRate, openEraSchema, FX_SOURCE_URL } from "./rates";
import { saveLiveRates, type FxSavedRate, type FxStore } from "./store";

/** 6-hour cache for the live pull (the provider itself updates once a day). */
export const FX_CACHE_MS = 6 * 60 * 60 * 1000;

export interface FxRateView {
  quote: string;
  localPerForeign: number;
  date: string; // YYYY-MM-DD
  source: "LIVE" | "SIMULATED" | "MANUAL";
  /** true → show the orange "Old rate" tag (still calculates) */
  old: boolean;
  /** true → data came from this request; false → served from saved data */
  live: boolean;
}

export type FxResult =
  | { ok: true; rates: FxRateView[] }
  | { ok: false; error: string };

interface LiveCache {
  fetchedAt: number;
  rates: { quote: string; localPerForeign: number; date: string }[];
}

let liveCache: LiveCache | null = null;

/** Test hook — clears the 6-hour in-memory cache. */
export function __resetFxCache(): void {
  liveCache = null;
}

async function savedView(store: FxStore, quote: string, today: string): Promise<FxRateView | null> {
  let saved: FxSavedRate | null = null;
  try {
    saved = await store.latestSaved(quote);
  } catch {
    return null;
  }
  if (!saved) return null;
  return {
    quote,
    localPerForeign: saved.localPerForeign,
    date: saved.date,
    source: saved.source,
    old: isOldRate(saved.date, today),
    live: false,
  };
}

export interface GetFxOptions {
  store: FxStore;
  fetchImpl?: FetchLike;
  now?: Date;
  quotes?: readonly FxQuote[];
}

export async function getFxRates(opts: GetFxOptions): Promise<FxResult> {
  const now = opts.now ?? new Date();
  const quotes = opts.quotes ?? FX_QUOTES;
  const today = todayIso(now);

  // Fresh 6-hour cache.
  if (liveCache && now.getTime() - liveCache.fetchedAt < FX_CACHE_MS) {
    return {
      ok: true,
      rates: liveCache.rates
        .filter((r) => quotes.includes(r.quote as FxQuote))
        .map((r) => ({ ...r, source: "LIVE" as const, old: false, live: true })),
    };
  }

  try {
    const json = openEraSchema.parse(
      await fetchJson<unknown>(FX_SOURCE_URL, { fetchImpl: opts.fetchImpl })
    );
    const rows = quotes.map((quote) => ({
      quote,
      localPerForeign: crossRate(json.rates, "NGN", quote),
      date: today,
    }));
    try {
      await saveLiveRates(opts.store, rows);
    } catch {
      // Failing to persist must not break the page — still show the live rates.
    }
    liveCache = { fetchedAt: now.getTime(), rates: rows };
    return {
      ok: true,
      rates: rows.map((r) => ({ ...r, source: "LIVE" as const, old: false, live: true })),
    };
  } catch {
    // Fall back to the last saved rate per currency.
    const rates: FxRateView[] = [];
    for (const quote of quotes) {
      const view = await savedView(opts.store, quote, today);
      if (view) rates.push(view);
    }
    if (rates.length === 0) {
      return {
        ok: false,
        error:
          "No exchange rate available right now. Try again later, or set a rate on the Rates page.",
      };
    }
    return { ok: true, rates };
  }
}
