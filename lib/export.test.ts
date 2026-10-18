// Export value logic tests (04-croptrade.md §Logic, step 3).

import { describe, expect, it } from "vitest";
import { bestRateAdvice, exportValue, type ExportInput } from "./export";

const TODAY = "2026-10-18"; // a Sunday

const base: ExportInput = {
  quote: "USD",
  qtyKg: 100,
  localPricePerKgKobo: 60_000, // ₦600 per kg
  localPerForeign: 1500, // 1 USD = ₦1,500
  exportCostPct: 10,
  today: TODAY,
};

describe("exportValue — normal case", () => {
  it("computes totalLocal in kobo and gross/net with 2 decimals", () => {
    const r = exportValue({ ...base, rateDate: TODAY });
    expect(r).toEqual({
      ok: true,
      quote: "USD",
      totalLocalKobo: 6_000_000, // 100 kg × ₦600 = ₦60,000 = 6,000,000 kobo
      grossForeign: 40, // ₦60,000 ÷ 1,500 = $40.00
      netForeign: 36, // $40 − 10% = $36.00
      oldRate: false,
    });
  });
});

describe("exportValue — export cost", () => {
  it("cost 0 → net equals gross", () => {
    const r = exportValue({ ...base, exportCostPct: 0, rateDate: TODAY });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.netForeign).toBe(r.grossForeign);
  });

  it("cost above 0 → net below gross", () => {
    const r = exportValue({ ...base, exportCostPct: 25, rateDate: TODAY });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.grossForeign).toBe(40);
      expect(r.netForeign).toBe(30);
    }
  });

  it("cost 100 → net is 0", () => {
    const r = exportValue({ ...base, exportCostPct: 100, rateDate: TODAY });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.netForeign).toBe(0);
  });

  it("cost out of range → one plain sentence", () => {
    for (const pct of [-1, 101, Number.NaN]) {
      const r = exportValue({ ...base, exportCostPct: pct });
      expect(r).toMatchObject({ ok: false, kind: "invalid" });
      if (!r.ok && r.kind === "invalid") {
        expect(r.error).toBe("Export cost must be a percentage from 0 to 100.");
      }
    }
  });
});

describe("exportValue — old rate flag", () => {
  it("rate exactly 7 days old is NOT old (it still calculates)", () => {
    const r = exportValue({ ...base, rateDate: "2026-10-11" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.oldRate).toBe(false);
      expect(r.grossForeign).toBe(40);
    }
  });

  it("rate 8 days old IS old (it still calculates)", () => {
    const r = exportValue({ ...base, rateDate: "2026-10-10" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.oldRate).toBe(true);
      expect(r.grossForeign).toBe(40);
      expect(r.netForeign).toBe(36);
    }
  });
});

describe("exportValue — missing rate", () => {
  it("null rate → no-rate result pointing at the Rates page, no throw", () => {
    expect(() => exportValue({ ...base, localPerForeign: null })).not.toThrow();
    const r = exportValue({ ...base, localPerForeign: null });
    expect(r).toMatchObject({ ok: false, kind: "no-rate", quote: "USD" });
    if (!r.ok && r.kind === "no-rate") {
      expect(r.error).toBe("No rate saved for USD yet. Set it on the Rates page.");
    }
  });

  it("undefined rate → same no-rate result", () => {
    const r = exportValue({ ...base, localPerForeign: undefined });
    expect(r).toMatchObject({ ok: false, kind: "no-rate" });
  });
});

describe("exportValue — bad input is rejected with one plain sentence", () => {
  it("qty 0 rejected", () => {
    const r = exportValue({ ...base, qtyKg: 0 });
    expect(r).toMatchObject({ ok: false, kind: "invalid" });
    if (!r.ok && r.kind === "invalid") {
      expect(r.error).toBe("Quantity must be more than 0 kg. Enter a kg amount above zero.");
    }
  });

  it("rate 0 rejected", () => {
    const r = exportValue({ ...base, localPerForeign: 0 });
    expect(r).toMatchObject({ ok: false, kind: "invalid" });
    if (!r.ok && r.kind === "invalid") {
      expect(r.error).toBe("The exchange rate must be above 0. Set a rate on the Rates page.");
    }
  });

  it("negative values rejected", () => {
    const negQty = exportValue({ ...base, qtyKg: -5 });
    expect(negQty).toMatchObject({ ok: false, kind: "invalid" });
    const negRate = exportValue({ ...base, localPerForeign: -1500 });
    expect(negRate).toMatchObject({ ok: false, kind: "invalid" });
    const negCost = exportValue({ ...base, exportCostPct: -10 });
    expect(negCost).toMatchObject({ ok: false, kind: "invalid" });
  });
});

describe("exportValue — rounding", () => {
  it("gross rounds to 2 decimals, net is computed from the rounded gross", () => {
    // 7 kg × ₦850 = ₦5,950 = 595,000 kobo; 5,950 ÷ 1,413.7 = 4.2088… → 4.21
    const r = exportValue({
      ...base,
      qtyKg: 7,
      localPricePerKgKobo: 85_000,
      localPerForeign: 1413.7,
      rateDate: TODAY,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.totalLocalKobo).toBe(595_000);
      expect(r.grossForeign).toBe(4.21);
      expect(r.netForeign).toBe(3.79); // 4.21 × 0.9 = 3.789 → 3.79
    }
  });

  it("tiny values still round to 2 decimals", () => {
    // ₦123.45 ÷ 400 = 0.308625 → 0.31; × 0.85 (cost 15%) = 0.2635 → 0.26
    const r = exportValue({
      ...base,
      qtyKg: 1,
      localPricePerKgKobo: 12_345,
      localPerForeign: 400,
      exportCostPct: 15,
      rateDate: TODAY,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.grossForeign).toBe(0.31);
      expect(r.netForeign).toBe(0.26);
    }
  });
});

describe("bestRateAdvice — today vs the 30-day best", () => {
  it("below: names the percentage", () => {
    expect(bestRateAdvice(1455, [1490, 1500, 1420])).toBe(
      "Today's rate is 3% below the 30-day best."
    );
  });

  it("equal: today is the best", () => {
    expect(bestRateAdvice(1500, [1490, 1500])).toBe(
      "Today's rate is the best of the last 30 days."
    );
  });

  it("above the history: also the best", () => {
    expect(bestRateAdvice(1510, [1490, 1500])).toBe(
      "Today's rate is the best of the last 30 days."
    );
  });

  it("rounds to 0% below → 'about the same'", () => {
    expect(bestRateAdvice(1499, [1500])).toBe(
      "Today's rate is about the same as the 30-day best."
    );
  });

  it("no history yet: says so", () => {
    expect(bestRateAdvice(1500, [])).toBe(
      "No 30-day rate history yet — today is the first rate."
    );
  });
});
