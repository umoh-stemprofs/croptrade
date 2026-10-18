// Store boundary for per-farm manual rates (injected, so isolation is testable).

import type { ManualRateRow } from "./manual";

export interface ManualRateStore {
  /** Only this farm's rows — never another farm's. */
  forFarm(farmId: string): Promise<ManualRateRow[]>;
  /** Upsert this farm's override for one currency, stamped today. */
  set(farmId: string, quote: string, localPerForeign: number): Promise<void>;
  /** "Use live rate again": delete this farm's override for one currency. */
  remove(farmId: string, quote: string): Promise<void>;
}
