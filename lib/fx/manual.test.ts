// Manual rates are per farm (04-croptrade.md):
// - a farm's manual rate wins over the shared live/saved rate
// - one farm's manual rate NEVER changes another farm's rate
// - a manual rate works even when the live call fails and nothing is saved
// - a manual rate older than 7 days carries the Old rate flag

import { beforeEach, describe, expect, it } from "vitest";
import { __resetFxCache } from "./service";
import { effectiveRates } from "./effective";
import { manualRateSchema, mergeManualRates, type ManualRateRow } from "./manual";
import type { ManualRateStore } from "./manualStore";
import type { FxSavedRate, FxStore, FxTickRef } from "./store";

function memoryFxStore(seed: FxSavedRate[] = []): FxStore {
  const rows = new Map<string, FxSavedRate & { id: string }>();
  let nextId = 1;
  for (const row of seed) rows.set(`${row.quote}|${row.date}`, { ...row, id: `id-${nextId++}` });
  return {
    async latestSaved(quote) {
      return (
        [...rows.values()]
          .filter((r) => r.quote === quote)
          .sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null
      );
    },
    async findByDate(quote, date): Promise<FxTickRef | null> {
      const found = rows.get(`${quote}|${date}`);
      return found ? { id: found.id, source: found.source } : null;
    },
    async create(row) {
      rows.set(`${row.quote}|${row.date}`, { ...row, id: `id-${nextId++}` });
    },
    async updateToLive(id, localPerForeign) {
      for (const [key, row] of rows) {
        if (row.id === id) rows.set(key, { ...row, localPerForeign, source: "LIVE" });
      }
    },
  };
}

function memoryManualStore(byFarm: Record<string, ManualRateRow[]> = {}): ManualRateStore {
  const map = new Map<string, ManualRateRow[]>(
    Object.entries(byFarm).map(([farmId, rows]) => [farmId, rows.map((r) => ({ ...r }))])
  );
  return {
    async forFarm(farmId) {
      return (map.get(farmId) ?? []).map((r) => ({ ...r }));
    },
    async set(farmId, quote, localPerForeign) {
      const rows = map.get(farmId) ?? [];
      map.set(
        farmId,
        [...rows.filter((r) => r.quote !== quote), { quote, localPerForeign, setOn: "2026-10-18" }]
      );
    },
    async remove(farmId, quote) {
      map.set(farmId, (map.get(farmId) ?? []).filter((r) => r.quote !== quote));
    },
  };
}

const failingFetch = (() =>
  Promise.reject(new Error("network down"))) as unknown as typeof fetch;

const okFetch = (() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({
      result: "success",
      base_code: "USD",
      rates: { USD: 1, NGN: 1500, EUR: 0.9, GBP: 0.75 },
    }),
  }) as unknown as Response) as unknown as typeof fetch;

const now = new Date("2026-10-18T12:00:00Z");

beforeEach(() => __resetFxCache());

describe("manual rate isolation", () => {
  it("a farm's manual rate replaces the shared rate for that farm only", async () => {
    const store = memoryFxStore();
    const manualStore = memoryManualStore({
      "farm-a": [{ quote: "USD", localPerForeign: 1600, setOn: "2026-10-18" }],
      "farm-b": [],
    });

    const a = await effectiveRates("farm-a", { store, manualStore, fetchImpl: okFetch, now });
    const b = await effectiveRates("farm-b", { store, manualStore, fetchImpl: okFetch, now });

    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.rates.find((r) => r.quote === "USD")).toMatchObject({
        localPerForeign: 1600,
        source: "MANUAL",
        live: false,
      });
      expect(b.rates.find((r) => r.quote === "USD")).toMatchObject({
        localPerForeign: 1500,
        source: "LIVE",
      });
      // Other currencies stay shared for both farms.
      expect(a.rates.find((r) => r.quote === "EUR")!.localPerForeign).toBe(
        b.rates.find((r) => r.quote === "EUR")!.localPerForeign
      );
    }
  });

  it("one farm's manual rate never changes another farm's rate", async () => {
    const store = memoryFxStore([
      { quote: "USD", date: "2026-10-17", localPerForeign: 1490, source: "LIVE" },
    ]);
    const manualStore = memoryManualStore({
      "farm-a": [{ quote: "USD", localPerForeign: 1700, setOn: "2026-10-17" }],
    });
    const b = await effectiveRates("farm-b", { store, manualStore, fetchImpl: failingFetch, now });
    expect(b.ok).toBe(true);
    if (b.ok) {
      expect(b.rates.find((r) => r.quote === "USD")!.localPerForeign).toBe(1490);
      expect(b.rates.every((r) => r.source !== "MANUAL")).toBe(true);
    }
  });

  it("a manual rate still works when the live call fails and nothing is saved", async () => {
    const manualStore = memoryManualStore({
      "farm-a": [{ quote: "GBP", localPerForeign: 2000, setOn: "2026-10-18" }],
    });
    const result = await effectiveRates("farm-a", {
      store: memoryFxStore(),
      manualStore,
      fetchImpl: failingFetch,
      now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rates).toHaveLength(1);
      expect(result.rates[0]).toMatchObject({ quote: "GBP", localPerForeign: 2000, source: "MANUAL" });
    }
  });

  it("flags a manual rate older than 7 days as Old rate (it still calculates)", async () => {
    const manualStore = memoryManualStore({
      "farm-a": [{ quote: "EUR", localPerForeign: 1650, setOn: "2026-10-01" }],
    });
    const result = await effectiveRates("farm-a", {
      store: memoryFxStore(),
      manualStore,
      fetchImpl: failingFetch,
      now,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rates[0]).toMatchObject({ localPerForeign: 1650, old: true });
    }
  });
});

describe("mergeManualRates", () => {
  it("ignores quotes outside USD, EUR, GBP", () => {
    const merged = mergeManualRates(
      [],
      [{ quote: "JPY", localPerForeign: 10, setOn: "2026-10-18" }],
      "2026-10-18"
    );
    expect(merged).toHaveLength(0);
  });

  it("keeps USD, EUR, GBP order", () => {
    const base = [
      { quote: "GBP", localPerForeign: 1900, date: "2026-10-18", source: "LIVE" as const, old: false, live: true },
      { quote: "USD", localPerForeign: 1500, date: "2026-10-18", source: "LIVE" as const, old: false, live: true },
    ];
    const merged = mergeManualRates(base, [], "2026-10-18");
    expect(merged.map((r) => r.quote)).toEqual(["USD", "GBP"]);
  });
});

describe("manualRateSchema", () => {
  it("accepts a positive rate", () => {
    expect(manualRateSchema.safeParse({ quote: "USD", localPerForeign: 1500 }).success).toBe(true);
  });

  it("rejects 0, negative and non-numeric rates with one sentence", () => {
    for (const value of [0, -5, Number.NaN]) {
      const parsed = manualRateSchema.safeParse({ quote: "USD", localPerForeign: value });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0].message).toMatch(/above 0|number/i);
    }
  });

  it("rejects a currency outside USD, EUR, GBP", () => {
    expect(manualRateSchema.safeParse({ quote: "JPY", localPerForeign: 10 }).success).toBe(false);
  });
});
