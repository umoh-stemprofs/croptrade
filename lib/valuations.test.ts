// Saved valuations (04-croptrade.md):
// - a farmer cannot read or delete another farmer's valuation
// - the saved math matches the result screen (net = gross × (1 − cost))
// - totals are per currency, never mixed

import { describe, expect, it } from "vitest";
import {
  buildValuation,
  deleteValuation,
  listValuations,
  saveValuation,
  valuationTotals,
  type ValuationDb,
  type ValuationRow,
} from "./valuations";

function row(overrides: Partial<ValuationRow> & Pick<ValuationRow, "id" | "farmId">): ValuationRow {
  return {
    crop: "MAIZE",
    qtyKg: 250,
    localPricePerKgKobo: 60000,
    quote: "USD",
    rate: 1500,
    grossForeign: 100,
    netForeign: 90,
    date: "2026-10-18",
    ...overrides,
  };
}

function memoryDb(rows: ValuationRow[] = []): ValuationDb & { rows: ValuationRow[] } {
  const farms: Record<string, { userId: string; id: string }> = {
    "farm-a": { id: "farm-a", userId: "user-a" },
    "farm-b": { id: "farm-b", userId: "user-b" },
  };
  const state = { rows: rows.map((r) => ({ ...r })) };
  return {
    ...state,
    get rows() {
      return state.rows;
    },
    async firstFarmForUser(userId) {
      const farm = Object.values(farms).find((f) => f.userId === userId);
      return farm ? { id: farm.id } : null;
    },
    async listForFarm(farmId) {
      return state.rows.filter((r) => r.farmId === farmId);
    },
    async create(newRow) {
      state.rows.push({ ...newRow, id: `v-${state.rows.length + 1}` });
    },
    async findById(id) {
      return state.rows.find((r) => r.id === id) ?? null;
    },
    async findFarmOwnedByUser(userId, farmId) {
      const farm = farms[farmId];
      return farm && farm.userId === userId ? { id: farm.id } : null;
    },
    async deleteById(id) {
      state.rows = state.rows.filter((r) => r.id !== id);
    },
  };
}

describe("cross-farm ownership", () => {
  it("lists only this farmer's valuations", async () => {
    const db = memoryDb([
      row({ id: "a1", farmId: "farm-a" }),
      row({ id: "b1", farmId: "farm-b", crop: "YAM" }),
    ]);
    const mine = await listValuations(db, "user-a");
    expect(mine.rows.map((r) => r.id)).toEqual(["a1"]);
    const theirs = await listValuations(db, "user-b");
    expect(theirs.rows.map((r) => r.id)).toEqual(["b1"]);
  });

  it("another farmer's valuation cannot be deleted — refused, and nothing changes", async () => {
    const db = memoryDb([row({ id: "a1", farmId: "farm-a" })]);
    const result = await deleteValuation(db, "user-b", "a1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found/i);
    expect(db.rows).toHaveLength(1);
  });

  it("deleting your own valuation works", async () => {
    const db = memoryDb([row({ id: "a1", farmId: "farm-a" })]);
    const result = await deleteValuation(db, "user-a", "a1");
    expect(result.ok).toBe(true);
    expect(db.rows).toHaveLength(0);
  });

  it("a saved valuation is always written to the acting farmer's own farm", async () => {
    const db = memoryDb();
    const built = buildValuation({
      crop: "MAIZE",
      qtyKg: 250,
      quote: "USD",
      exportCostPct: 10,
      priceKobo: 60000,
      localPerForeign: 1500,
      rateDate: "2026-10-18",
      today: "2026-10-18",
    });
    expect(built.ok).toBe(true);
    if (built.ok) {
      const saved = await saveValuation(db, "user-b", built.row);
      expect(saved.ok).toBe(true);
      expect(db.rows[0].farmId).toBe("farm-b");
    }
  });
});

describe("saved valuation math", () => {
  it("stores the same gross and net the result screen showed", () => {
    const built = buildValuation({
      crop: "MAIZE",
      qtyKg: 250,
      quote: "USD",
      exportCostPct: 10,
      priceKobo: 60000, // ₦600/kg → ₦150,000 total
      localPerForeign: 1500, // 1 USD = ₦1,500
      rateDate: "2026-10-18",
      today: "2026-10-18",
    });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.row).toMatchObject({
        crop: "MAIZE",
        qtyKg: 250,
        localPricePerKgKobo: 60000,
        quote: "USD",
        rate: 1500,
        grossForeign: 100,
        netForeign: 90,
        date: "2026-10-18",
      });
    }
  });

  it("rejects an unusable rate or quantity with one sentence", () => {
    const base = {
      crop: "MAIZE",
      qtyKg: 250,
      quote: "USD",
      exportCostPct: 0,
      priceKobo: 60000,
      localPerForeign: 1500,
      rateDate: "2026-10-18",
      today: "2026-10-18",
    };
    const zeroRate = buildValuation({ ...base, localPerForeign: 0 });
    expect(zeroRate.ok).toBe(false);
    const zeroQty = buildValuation({ ...base, qtyKg: 0 });
    expect(zeroQty.ok).toBe(false);
    const badCost = buildValuation({ ...base, exportCostPct: 101 });
    expect(badCost.ok).toBe(false);
  });
});

describe("valuationTotals", () => {
  it("adds per currency and never mixes them", () => {
    const totals = valuationTotals([
      { quote: "USD", netForeign: 100.1 },
      { quote: "EUR", netForeign: 50 },
      { quote: "USD", netForeign: 0.2 },
    ]);
    expect(totals).toEqual([
      { quote: "USD", total: 100.3 },
      { quote: "EUR", total: 50 },
    ]);
  });

  it("ignores broken numbers", () => {
    expect(valuationTotals([{ quote: "GBP", netForeign: Number.NaN }])).toEqual([]);
  });
});
