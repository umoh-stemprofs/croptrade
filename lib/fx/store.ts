// FX storage rules (04-croptrade.md):
// Save each live rate in FxTick with source LIVE. A live rate may replace a SIMULATED
// rate for the same date. It must never replace a MANUAL one.

export type FxSourceKey = "LIVE" | "SIMULATED" | "MANUAL";

export interface FxSavedRate {
  quote: string;
  localPerForeign: number;
  date: string; // YYYY-MM-DD
  source: FxSourceKey;
}

export interface FxTickRef {
  id: string;
  source: FxSourceKey;
}

export interface FxStore {
  /** Latest saved tick for a quote, any source. */
  latestSaved(quote: string): Promise<FxSavedRate | null>;
  /** The tick stored for one exact date (quote+date is unique), or null. */
  findByDate(quote: string, date: string): Promise<FxTickRef | null>;
  create(row: { quote: string; date: string; localPerForeign: number; source: "LIVE" }): Promise<void>;
  updateToLive(id: string, localPerForeign: number): Promise<void>;
}

/**
 * Persist freshly fetched live rates. Rules:
 * - no tick for that date yet → create with source LIVE
 * - existing SIMULATED (or LIVE refresh) → overwrite with the live value
 * - existing MANUAL → skip; the farmer's override wins
 */
export async function saveLiveRates(
  store: FxStore,
  rows: { quote: string; date: string; localPerForeign: number }[]
): Promise<void> {
  for (const row of rows) {
    const existing = await store.findByDate(row.quote, row.date);
    if (!existing) {
      await store.create({ ...row, source: "LIVE" });
      continue;
    }
    if (existing.source === "MANUAL") continue;
    await store.updateToLive(existing.id, row.localPerForeign);
  }
}
