// Market feed adapter (00-global §3): interface MarketProvider.
// SimulatedProvider is the default. If MARKET_API_URL is set, LiveProvider fetches
// it and falls back to Simulated on failure. The item's own `source` is the real source,
// so the data-source badge never lies.

import { z } from "zod";
import { CATALOG, getCatalogEntry } from "./catalog";
import { priceKobo } from "./generator";
import { addDaysIso, todayIso } from "../time";
import { fetchJson, type FetchLike } from "../server/http";

export type MarketSource = "SIMULATED" | "LIVE";

export interface MarketPrice {
  crop: string;
  date: string; // YYYY-MM-DD
  priceKobo: number;
  unit: "KG" | "TRAY" | "LITRE";
  source: MarketSource;
}

export interface MarketProvider {
  /** Latest price of every crop. */
  latestPrices(): Promise<MarketPrice[]>;
  /** Daily history for one crop, oldest first. days 1..90. */
  history(crop: string, days: number): Promise<MarketPrice[]>;
}

export class SimulatedProvider implements MarketProvider {
  readonly name = "SIMULATED";

  latestPrices(now: Date = new Date()): Promise<MarketPrice[]> {
    const today = todayIso(now);
    return Promise.resolve(
      CATALOG.map((entry) => ({
        crop: entry.crop,
        date: today,
        priceKobo: priceKobo(entry.crop, entry.salt, entry.base, today),
        unit: entry.unit,
        source: "SIMULATED" as const,
      }))
    );
  }

  history(crop: string, days: number, now: Date = new Date()): Promise<MarketPrice[]> {
    const entry = getCatalogEntry(crop);
    if (!entry) return Promise.reject(new Error(`Unknown crop "${crop}".`));
    if (days < 1 || days > 90) {
      return Promise.reject(new Error("Days must be a whole number from 1 to 90."));
    }
    const today = todayIso(now);
    const rows: MarketPrice[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = addDaysIso(today, -i);
      rows.push({
        crop: entry.crop,
        date,
        priceKobo: priceKobo(entry.crop, entry.salt, entry.base, date),
        unit: entry.unit,
        source: "SIMULATED",
      });
    }
    return Promise.resolve(rows);
  }
}

/** Contract for a live feed: a JSON array of MarketPrice-shaped objects. */
const livePriceSchema = z
  .array(
    z.object({
      crop: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      priceKobo: z.number().int().positive(),
      unit: z.enum(["KG", "TRAY", "LITRE"]),
      source: z.enum(["LIVE", "SIMULATED"]),
    })
  )
  .min(1);

export class LiveProvider implements MarketProvider {
  readonly name = "LIVE";

  constructor(
    private readonly url: string,
    private readonly fallback: MarketProvider = new SimulatedProvider(),
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  private async fetchLive(params: Record<string, string>): Promise<MarketPrice[]> {
    const url = new URL(this.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const json = await fetchJson<unknown>(url.toString(), { fetchImpl: this.fetchImpl });
    return livePriceSchema.parse(json);
  }

  async latestPrices(): Promise<MarketPrice[]> {
    try {
      return await this.fetchLive({});
    } catch {
      return this.fallback.latestPrices();
    }
  }

  async history(crop: string, days: number): Promise<MarketPrice[]> {
    try {
      const rows = await this.fetchLive({ crop, days: String(days) });
      return rows.filter((r) => r.crop === crop).slice(-days);
    } catch {
      return this.fallback.history(crop, days);
    }
  }
}

let cached: MarketProvider | null = null;

/** Server-side singleton. MARKET_API_URL switches on the live feed with simulated fallback. */
export function getMarketProvider(): MarketProvider {
  if (cached) return cached;
  const url = process.env.MARKET_API_URL?.trim();
  cached = url ? new LiveProvider(url, new SimulatedProvider()) : new SimulatedProvider();
  return cached;
}
