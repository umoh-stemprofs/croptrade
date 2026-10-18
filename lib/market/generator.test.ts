// The same crop + date must always give the same price (00-global §3).

import { describe, expect, it } from "vitest";
import { CATALOG, getCatalogEntry } from "./catalog";
import { priceKobo, priceNaira } from "./generator";

describe("deterministic price generator", () => {
  it("gives the same price for the same crop and date, every time", () => {
    for (const entry of CATALOG) {
      const a = priceNaira(entry.crop, entry.salt, entry.base, "2026-06-15");
      const b = priceNaira(entry.crop, entry.salt, entry.base, "2026-06-15");
      expect(a).toBe(b);
    }
  });

  it("gives different prices on different days (but stays in range)", () => {
    const entry = getCatalogEntry("MAIZE")!;
    const prices = new Set<number>();
    for (let day = 0; day < 60; day++) {
      const date = new Date(Date.UTC(2026, 0, 1) + day * 86_400_000)
        .toISOString()
        .slice(0, 10);
      prices.add(priceNaira(entry.crop, entry.salt, entry.base, date));
    }
    expect(prices.size).toBeGreaterThan(10);
  });

  it("keeps every price inside the ±0.35 clamp", () => {
    const entry = getCatalogEntry("EGGS_TRAY")!;
    const min = Math.round(entry.base * Math.exp(-0.35));
    const max = Math.round(entry.base * Math.exp(0.35));
    for (let day = 0; day < 300; day += 7) {
      const date = new Date(Date.UTC(2026, 0, 1) + day * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const price = priceNaira(entry.crop, entry.salt, entry.base, date);
      expect(price).toBeGreaterThanOrEqual(min);
      expect(price).toBeLessThanOrEqual(max);
    }
  });

  it("kobo price is the naira price times 100", () => {
    const entry = getCatalogEntry("YAM")!;
    expect(priceKobo(entry.crop, entry.salt, entry.base, "2026-03-01")).toBe(
      priceNaira(entry.crop, entry.salt, entry.base, "2026-03-01") * 100
    );
  });

  it("throws a one-sentence error before the start date", () => {
    const entry = getCatalogEntry("MAIZE")!;
    expect(() => priceNaira(entry.crop, entry.salt, entry.base, "2025-12-31")).toThrow(
      /before 2026-01-01/
    );
  });
});
