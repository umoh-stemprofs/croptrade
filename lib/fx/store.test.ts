// FX storage rules and service fallback:
// - LIVE may replace SIMULATED for the same date, but never MANUAL
// - a failed fetch falls back to the last saved rate with the Saved data badge
// - a saved rate older than 7 days carries the Old rate flag
// - no rate at all returns a one-sentence error, no crash

import { beforeEach, describe, expect, it } from "vitest";
import { __resetFxCache, getFxRates } from "./service";
import { saveLiveRates, type FxSavedRate, type FxStore, type FxTickRef } from "./store";

function memoryStore(seed: FxSavedRate[] = []): FxStore & { rows: Map<string, FxSavedRate & { id: string }> } {
  const rows = new Map<string, FxSavedRate & { id: string }>();
  let nextId = 1;
  for (const row of seed) {
    rows.set(`${row.quote}|${row.date}`, { ...row, id: `id-${nextId++}` });
  }
  return {
    rows,
    async latestSaved(quote) {
      const all = [...rows.values()].filter((r) => r.quote === quote).sort((a, b) => (a.date < b.date ? 1 : -1));
      return all[0] ?? null;
    },
    async findByDate(quote, date) {
      const found = rows.get(`${quote}|${date}`);
      return found ? ({ id: found.id, source: found.source } as FxTickRef) : null;
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

const failingFetch = (() =>
  Promise.reject(new Error("network down"))) as unknown as typeof fetch;

const liveFixture = {
  result: "success",
  base_code: "USD",
  rates: { USD: 1, NGN: 1500, EUR: 0.9, GBP: 0.75 },
  time_last_update_utc: "Sun, 18 Oct 2026 00:02:31 +0000",
};

const okFetch = (() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => liveFixture,
  }) as unknown as Response) as unknown as typeof fetch;

beforeEach(() => __resetFxCache());

describe("saveLiveRates rules", () => {
  it("creates a LIVE tick when none exists for that date", async () => {
    const store = memoryStore();
    await saveLiveRates(store, [{ quote: "USD", date: "2026-10-18", localPerForeign: 1490 }]);
    expect(store.rows.get("USD|2026-10-18")).toMatchObject({ source: "LIVE", localPerForeign: 1490 });
  });

  it("replaces a SIMULATED rate for the same date", async () => {
    const store = memoryStore([
      { quote: "USD", date: "2026-10-18", localPerForeign: 1500, source: "SIMULATED" },
    ]);
    await saveLiveRates(store, [{ quote: "USD", date: "2026-10-18", localPerForeign: 1491 }]);
    expect(store.rows.get("USD|2026-10-18")).toMatchObject({ source: "LIVE", localPerForeign: 1491 });
  });

  it("never overwrites a MANUAL rate", async () => {
    const store = memoryStore([
      { quote: "USD", date: "2026-10-18", localPerForeign: 1600, source: "MANUAL" },
    ]);
    await saveLiveRates(store, [{ quote: "USD", date: "2026-10-18", localPerForeign: 1491 }]);
    expect(store.rows.get("USD|2026-10-18")).toMatchObject({ source: "MANUAL", localPerForeign: 1600 });
  });

  it("leaves other dates untouched", async () => {
    const store = memoryStore([
      { quote: "EUR", date: "2026-10-17", localPerForeign: 1620, source: "MANUAL" },
    ]);
    await saveLiveRates(store, [{ quote: "EUR", date: "2026-10-18", localPerForeign: 1630 }]);
    expect(store.rows.get("EUR|2026-10-17")).toMatchObject({ source: "MANUAL" });
    expect(store.rows.get("EUR|2026-10-18")).toMatchObject({ source: "LIVE" });
  });
});

describe("getFxRates", () => {
  it("fetches live rates, computes cross rates and marks them Live", async () => {
    const store = memoryStore();
    const result = await getFxRates({ store, fetchImpl: okFetch, now: new Date("2026-10-18T12:00:00Z") });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const usd = result.rates.find((r) => r.quote === "USD")!;
      const eur = result.rates.find((r) => r.quote === "EUR")!;
      expect(usd.localPerForeign).toBe(1500);
      expect(eur.localPerForeign).toBe(1666.6667);
      expect(result.rates.every((r) => r.live && r.source === "LIVE" && !r.old)).toBe(true);
    }
  });

  it("saves each live rate into the store as LIVE", async () => {
    const store = memoryStore();
    await getFxRates({ store, fetchImpl: okFetch, now: new Date("2026-10-18T12:00:00Z") });
    expect(store.rows.get("USD|2026-10-18")).toMatchObject({ source: "LIVE" });
    expect(store.rows.get("EUR|2026-10-18")).toMatchObject({ source: "LIVE" });
    expect(store.rows.get("GBP|2026-10-18")).toMatchObject({ source: "LIVE" });
  });

  it("falls back to the last saved rate with Saved data when the call fails", async () => {
    const store = memoryStore([
      { quote: "USD", date: "2026-10-16", localPerForeign: 1495, source: "LIVE" },
      { quote: "EUR", date: "2026-10-16", localPerForeign: 1630, source: "LIVE" },
      { quote: "GBP", date: "2026-10-16", localPerForeign: 1925, source: "LIVE" },
    ]);
    const result = await getFxRates({ store, fetchImpl: failingFetch, now: new Date("2026-10-18T12:00:00Z") });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rates).toHaveLength(3);
      expect(result.rates.every((r) => !r.live && !r.old)).toBe(true);
      expect(result.rates.find((r) => r.quote === "USD")!.localPerForeign).toBe(1495);
    }
  });

  it("tags a saved rate older than 7 days as Old rate", async () => {
    const store = memoryStore([
      { quote: "USD", date: "2026-10-01", localPerForeign: 1450, source: "LIVE" },
    ]);
    const result = await getFxRates({ store, fetchImpl: failingFetch, now: new Date("2026-10-18T12:00:00Z") });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rates[0].old).toBe(true);
      expect(result.rates[0].localPerForeign).toBe(1450); // still calculates
    }
  });

  it("returns a one-sentence error when there is no rate and no saved data", async () => {
    const result = await getFxRates({ store: memoryStore(), fetchImpl: failingFetch });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no exchange rate available/i);
  });

  it("never serves a simulated tick — placeholder data reads as absent", async () => {
    // Legacy rows may still carry source SIMULATED; they are not real pulls,
    // so the fallback must behave as if nothing was saved at all.
    const store = memoryStore([
      { quote: "USD", date: "2026-10-16", localPerForeign: 9999, source: "SIMULATED" },
    ]);
    const result = await getFxRates({ store, fetchImpl: failingFetch, now: new Date("2026-10-18T12:00:00Z") });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no exchange rate available/i);
  });
});
