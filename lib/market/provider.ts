// Market provider — the only price source is the live WFP feed (lib/market/wfp.ts).
// There is deliberately no simulated fallback and no local price table: when the
// network fails the provider throws a MarketFeedError and the screen shows an error
// state with "Try again".
//
// The item's `source` is always the real source, so the data-source badge never lies.

import { getCatalogEntry } from "./catalog";
import { loadMarketFeed, seriesFor, type MarketFeed } from "./wfp";
import { todayIso } from "../time";

export const MARKET_SOURCE_LABEL = "WFP · HDX";

export type MarketSource = "LIVE";

export interface MarketPrice {
  crop: string;
  date: string; // YYYY-MM-DD
  priceKobo: number;
  unit: "KG" | "TRAY" | "LITRE";
  source: MarketSource;
}

export interface MarketProvider {
  readonly name: string;
  /** The whole live feed (observations + newest quote per crop). */
  feed(): Promise<MarketFeed>;
  /** Newest price of every crop the feed covers. */
  latestPrices(): Promise<MarketPrice[]>;
  /** Daily history for one crop, oldest first. days 1..90. */
  history(crop: string, days: number): Promise<MarketPrice[]>;
}

export class WfpProvider implements MarketProvider {
  readonly name = MARKET_SOURCE_LABEL;

  constructor(private readonly loadFeed: () => Promise<MarketFeed> = () => loadMarketFeed()) {}

  feed(): Promise<MarketFeed> {
    return this.loadFeed();
  }

  async latestPrices(): Promise<MarketPrice[]> {
    const feed = await this.feed();
    return feed.quotes.map((quote) => ({
      crop: quote.crop,
      date: quote.date,
      priceKobo: quote.priceKobo,
      unit: quote.unit,
      source: "LIVE" as const,
    }));
  }

  async history(crop: string, days: number): Promise<MarketPrice[]> {
    const entry = getCatalogEntry(crop);
    if (!entry) throw new Error(`Unknown crop "${crop}".`);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      throw new Error("Days must be a whole number from 1 to 90.");
    }
    const feed = await this.feed();
    // The feed lags a few days, so the window ends at its newest observation rather
    // than today — otherwise "7 days" would be nearly empty and look like no data.
    const anchor = feed.asOf || todayIso();
    return seriesFor(feed.observations, crop, days, anchor).map((point) => ({
      crop,
      date: point.date,
      priceKobo: point.priceKobo,
      unit: entry.unit,
      source: "LIVE" as const,
    }));
  }
}

let cached: MarketProvider | null = null;

/** Server-side singleton. */
export function getMarketProvider(): MarketProvider {
  if (!cached) cached = new WfpProvider();
  return cached;
}
