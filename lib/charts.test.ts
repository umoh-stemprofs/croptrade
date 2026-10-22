// Chart data helpers (step 5): value by crop, "Other" grouping, gaps for missing
// days, sorting and axis labels. Pure functions — no React, no database.

import { describe, expect, it } from "vitest";
import {
  MAX_PIE_SLICES,
  OTHER_LABEL,
  compactMoney,
  compactNaira,
  money,
  naira,
  pieSlices,
  priceSeries,
  rateSeries,
  shortDate,
  sourceWord,
  stockValueByCrop,
  valuationBars,
} from "./charts";

const labelFor = (crop: string) =>
  ({ MAIZE: "Maize", CASSAVA: "Cassava", YAM: "Yam", TOMATO: "Tomato" })[crop] ?? crop;

describe("stockValueByCrop", () => {
  it("adds rows of the same crop and sorts biggest first", () => {
    const slices = stockValueByCrop(
      [
        { crop: "MAIZE", qtyKg: 100, priceKobo: 60_000 }, // ₦60,000
        { crop: "YAM", qtyKg: 10, priceKobo: 900_000 }, // ₦90,000 (low qty, high price)
        { crop: "MAIZE", qtyKg: 50, priceKobo: 60_000 }, // + ₦30,000 → ₦90,000
      ],
      labelFor
    );
    expect(slices.map((s) => [s.crop, s.valueKobo])).toEqual([
      ["MAIZE", 9_000_000],
      ["YAM", 9_000_000],
    ]);
    // Equal values fall back to the label, so the order never wobbles.
    expect(slices[0].label).toBe("Maize");
  });

  it("leaves out rows with no price or no quantity instead of drawing zero", () => {
    const slices = stockValueByCrop(
      [
        { crop: "MAIZE", qtyKg: 100, priceKobo: 0 },
        { crop: "YAM", qtyKg: 0, priceKobo: 60_000 },
        { crop: "TOMATO", qtyKg: 5, priceKobo: 70_000 },
      ],
      labelFor
    );
    expect(slices).toEqual([{ crop: "TOMATO", label: "Tomato", valueKobo: 350_000 }]);
  });

  it("returns an empty list when there is no stock", () => {
    expect(stockValueByCrop([], labelFor)).toEqual([]);
  });
});

describe("pieSlices — max 5 slices, the rest as Other", () => {
  const slice = (crop: string, valueKobo: number) => ({
    crop,
    label: crop,
    valueKobo,
  });

  it("keeps every crop while there are 5 or fewer", () => {
    const five = [slice("A", 500), slice("B", 400), slice("C", 300), slice("D", 200), slice("E", 100)];
    expect(pieSlices(five)).toHaveLength(MAX_PIE_SLICES);
    expect(pieSlices(five).map((s) => s.name)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("groups the small ones into Other, keeping the total value", () => {
    const six = [
      slice("A", 600),
      slice("B", 500),
      slice("C", 400),
      slice("D", 300),
      slice("E", 200),
      slice("F", 100),
    ];
    const slices = pieSlices(six);
    expect(slices).toHaveLength(MAX_PIE_SLICES);
    expect(slices.map((s) => s.name)).toEqual(["A", "B", "C", "D", OTHER_LABEL]);
    expect(slices[4].valueKobo).toBe(300); // E + F
    expect(slices.reduce((sum, s) => sum + s.valueKobo, 0)).toBe(2100);
  });

  it("has no pie data when there is no stock", () => {
    expect(pieSlices([])).toEqual([]);
  });
});

describe("rateSeries — gaps are gaps, never invented", () => {
  const history = [
    { date: "2026-10-15", localPerForeign: 1500, source: "LIVE" },
    { date: "2026-10-18", localPerForeign: 1520, source: "LIVE" },
  ];

  it("returns one point per day, oldest first, with null for missing days", () => {
    const series = rateSeries(history, { days: 5, today: "2026-10-19" });
    expect(series.map((p) => p.date)).toEqual([
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
    ]);
    expect(series.map((p) => p.rate)).toEqual([1500, null, null, 1520, null]);
    expect(series[1].source).toBeNull();
  });

  it("puts today's live rate on today even before it is saved", () => {
    const series = rateSeries(history, {
      days: 3,
      today: "2026-10-19",
      current: { date: "2026-10-19", localPerForeign: 1533.4, source: "LIVE" },
    });
    expect(series[2]).toEqual({ date: "2026-10-19", rate: 1533.4, source: "LIVE" });
  });

  it("lets a manual rate stand from the day it was set until today", () => {
    const series = rateSeries(history, {
      days: 5,
      today: "2026-10-19",
      current: { date: "2026-10-17", localPerForeign: 1600, source: "MANUAL" },
    });
    expect(series.map((p) => p.rate)).toEqual([1500, null, 1600, 1600, 1600]);
    expect(series[2].source).toBe("MANUAL");
    expect(series[3].source).toBe("MANUAL"); // overwrites the saved 1,520
  });

  it("ignores overrides with an unusable rate", () => {
    const series = rateSeries(history, {
      days: 1,
      today: "2026-10-19",
      current: { date: "2026-10-19", localPerForeign: 0, source: "MANUAL" },
    });
    expect(series).toEqual([{ date: "2026-10-19", rate: null, source: null }]);
  });
});

describe("priceSeries", () => {
  it("keeps missing days as gaps and sorts oldest first", () => {
    const series = priceSeries(
      [
        { date: "2026-10-17", priceKobo: 61_000 },
        { date: "2026-10-19", priceKobo: 63_000 },
      ],
      { days: 4, today: "2026-10-19" }
    );
    expect(series.map((p) => p.date)).toEqual([
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
    ]);
    expect(series.map((p) => p.priceKobo)).toEqual([null, 61_000, null, 63_000]);
  });
});

describe("valuationBars", () => {
  it("orders bars oldest first and drops broken amounts", () => {
    const bars = valuationBars(
      [
        { id: "b", crop: "YAM", quote: "USD", netForeign: 40, date: "2026-10-19" },
        { id: "a", crop: "MAIZE", quote: "USD", netForeign: 100, date: "2026-10-17" },
        { id: "c", crop: "MAIZE", quote: "USD", netForeign: 0, date: "2026-10-18" },
        { id: "d", crop: "MAIZE", quote: "USD", netForeign: Number.NaN, date: "2026-10-18" },
      ],
      labelFor
    );
    expect(bars.map((b) => b.id)).toEqual(["a", "b"]);
    expect(bars[1].label).toBe("Yam");
  });
});

describe("labels and axis units", () => {
  it("formats short dates without a time-zone library", () => {
    expect(shortDate("2026-10-19")).toBe("19 Oct");
    expect(shortDate("bad-date")).toBe("bad-date");
  });

  it("formats naira and foreign units for axes and tooltips", () => {
    expect(naira(150_000)).toBe("₦150,000");
    expect(compactNaira(1500)).toBe("₦1.5k");
    expect(compactNaira(1_500_000)).toBe("₦1.5m");
    expect(compactMoney(1500, "USD")).toBe("$1.5k");
    expect(money(100, "USD")).toBe("$100.00");
    expect(money(50, "EUR")).toBe("€50.00");
  });

  it("names every source in words", () => {
    expect(sourceWord("LIVE")).toBe("Live");
    // A simulated tick is placeholder data and is never served (fx/service.ts);
    // if one ever reached a label it must read as absent, not as a value.
    expect(sourceWord("SIMULATED")).toBe("No data");
    expect(sourceWord("MANUAL")).toBe("Manual");
    expect(sourceWord("SAVED")).toBe("Saved data");
    expect(sourceWord(null)).toBe("No data");
  });
});
