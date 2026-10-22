// Effective exchange rates for ONE farm (server only).
// ManualRate wins → otherwise the shared latest live/saved FxTick rate (a
// simulated tick is placeholder data and is never served — see service.ts).
// Every page that shows or uses a rate goes through here so no farm ever sees
// another farm's override.

import { getFxRates, type FxResult } from "./service";
import type { ManualRateRow } from "./manual";
import type { ManualRateStore } from "./manualStore";
import type { FxStore } from "./store";
import { prismaManualStore } from "./prismaManualStore";
import { prismaFxStore } from "./prismaStore";
import type { FetchLike } from "../server/http";

export interface EffectiveRatesOptions {
  store?: FxStore;
  manualStore?: ManualRateStore;
  fetchImpl?: FetchLike;
  now?: Date;
}

export async function effectiveRates(
  farmId: string,
  opts: EffectiveRatesOptions = {}
): Promise<FxResult> {
  const manualStore = opts.manualStore ?? prismaManualStore;
  let manual: ManualRateRow[] = [];
  try {
    manual = await manualStore.forFarm(farmId);
  } catch {
    // If the override table is unreachable, show the shared rates instead of failing.
    manual = [];
  }
  return getFxRates({
    store: opts.store ?? prismaFxStore,
    manual,
    fetchImpl: opts.fetchImpl,
    now: opts.now,
  });
}

/** The effective rate for one currency, or null when the farm has none. */
export function rateFor(
  result: FxResult,
  quote: string
): { quote: string; localPerForeign: number; date: string; source: string; old: boolean } | null {
  if (!result.ok) return null;
  const row = result.rates.find((r) => r.quote === quote);
  return row ? { ...row } : null;
}
