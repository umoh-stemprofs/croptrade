// Saved valuations (04-croptrade.md): every row belongs to ONE farm.
// The build step is pure and reuses lib/export.ts; the database boundary is injected
// so the ownership rules are unit-tested (a farm can never read or delete another
// farm's valuation).

import { FX_QUOTES } from "./config";
import { exportValue } from "./export";

export interface ValuationRow {
  id: string;
  farmId: string;
  crop: string;
  qtyKg: number;
  localPricePerKgKobo: number;
  quote: string;
  rate: number;
  grossForeign: number;
  netForeign: number;
  date: string; // YYYY-MM-DD
}

export interface ValuationDb {
  firstFarmForUser(userId: string): Promise<{ id: string } | null>;
  listForFarm(farmId: string): Promise<ValuationRow[]>;
  create(row: Omit<ValuationRow, "id">): Promise<void>;
  findById(id: string): Promise<ValuationRow | null>;
  findFarmOwnedByUser(userId: string, farmId: string): Promise<{ id: string } | null>;
  deleteById(id: string): Promise<void>;
}

export type ValuationResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND = "That saved valuation was not found.";

export interface BuildValuationInput {
  crop: string;
  qtyKg: number;
  quote: string;
  exportCostPct: number;
  /** Latest price per kg for the crop, integer kobo. */
  priceKobo: number;
  /** Effective rate for this farm: "1 foreign = X local". */
  localPerForeign: number;
  rateDate: string;
  today: string;
}

export type BuiltValuation = Omit<ValuationRow, "id" | "farmId">;

/** Math for one saved valuation — exactly the numbers the result screen showed. */
export function buildValuation(
  input: BuildValuationInput
): { ok: true; row: BuiltValuation } | { ok: false; error: string } {
  const result = exportValue({
    quote: input.quote,
    qtyKg: input.qtyKg,
    localPricePerKgKobo: input.priceKobo,
    localPerForeign: input.localPerForeign,
    rateDate: input.rateDate,
    exportCostPct: input.exportCostPct,
    today: input.today,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    row: {
      crop: input.crop,
      qtyKg: input.qtyKg,
      localPricePerKgKobo: input.priceKobo,
      quote: input.quote,
      rate: input.localPerForeign,
      grossForeign: result.grossForeign,
      netForeign: result.netForeign,
      date: input.today,
    },
  };
}

/** This user's farm and its valuations only, newest first. */
export async function listValuations(
  db: ValuationDb,
  userId: string
): Promise<{ farmId: string | null; rows: ValuationRow[] }> {
  const farm = await db.firstFarmForUser(userId);
  if (!farm) return { farmId: null, rows: [] };
  return { farmId: farm.id, rows: await db.listForFarm(farm.id) };
}

export async function saveValuation(
  db: ValuationDb,
  userId: string,
  built: BuiltValuation
): Promise<ValuationResult> {
  const farm = await db.firstFarmForUser(userId);
  if (!farm) return { ok: false, error: "No farm found for this account." };
  await db.create({ ...built, farmId: farm.id });
  return { ok: true };
}

/** Delete only if the valuation's farm belongs to the acting user. */
export async function deleteValuation(
  db: ValuationDb,
  userId: string,
  id: string
): Promise<ValuationResult> {
  const row = await db.findById(id);
  const farm = row ? await db.findFarmOwnedByUser(userId, row.farmId) : null;
  if (!row || !farm) return { ok: false, error: NOT_FOUND };
  await db.deleteById(id);
  return { ok: true };
}

/** Net totals per currency (mixed currencies are never added together). */
export function valuationTotals(
  rows: readonly { quote: string; netForeign: number }[]
): { quote: string; total: number }[] {
  const sums = new Map<string, number>();
  for (const row of rows) {
    if (!Number.isFinite(row.netForeign)) continue;
    sums.set(row.quote, (sums.get(row.quote) ?? 0) + row.netForeign);
  }
  const order = (quote: string) => {
    const index = FX_QUOTES.indexOf(quote as (typeof FX_QUOTES)[number]);
    return index === -1 ? FX_QUOTES.length : index;
  };
  return [...sums.keys()]
    .sort((a, b) => order(a) - order(b))
    .map((quote) => ({ quote, total: Math.round(sums.get(quote)! * 100) / 100 }));
}
