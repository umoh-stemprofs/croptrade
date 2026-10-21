// Converter math: parse, clamp, settlement arithmetic, shortfall, formatting,
// and a parity-slip built only from what the caller passed in.

import { describe, expect, it } from "vitest";
import {
  buildSlip,
  clamp,
  fmt,
  money,
  parseAmount,
  pct,
  roundTo,
  settlement,
  signed,
} from "./calc";

describe("parseAmount", () => {
  it("accepts grouped and underscored numbers", () => {
    expect(parseAmount("601,690")).toBe(601690);
    expect(parseAmount("1_500.5")).toBe(1500.5);
    expect(parseAmount(" 99 ")).toBe(99);
  });

  it("rejects empty and non-numeric input with NaN", () => {
    expect(Number.isNaN(parseAmount(""))).toBe(true);
    expect(Number.isNaN(parseAmount("-"))).toBe(true);
    expect(Number.isNaN(parseAmount("abc"))).toBe(true);
    expect(Number.isNaN(parseAmount(null))).toBe(true);
  });
});

describe("clamp / roundTo / fmt", () => {
  it("clamps into range", () => {
    expect(clamp(0.4, 1, 5)).toBe(1);
    expect(clamp(9, 1, 5)).toBe(5);
    expect(clamp(2.5, 1, 5)).toBe(2.5);
  });

  it("rounds to the requested decimals", () => {
    expect(roundTo(1.2345, 2)).toBe(1.23);
    expect(roundTo(1.236, 2)).toBe(1.24);
    expect(roundTo(12.3456, 3)).toBe(12.346);
  });

  it("formats non-finite values as an em dash", () => {
    expect(fmt(NaN)).toBe("—");
    expect(fmt(1234.5)).toBe("1,234.50");
  });
});

describe("money and signed", () => {
  it("uses per-currency symbols and digits", () => {
    expect(money(451.85, "USD")).toBe("$451.85");
    expect(money(601690, "NGN")).toBe("₦601,690");
    expect(money(1234.5, "XOF")).toBe("CFA 1,235");
  });

  it("a deduction that rounds to zero reads as empty, not −$0.00", () => {
    expect(signed(0, "USD")).toBe("");
    expect(signed(0.001, "USD")).toBe("");
    expect(signed(12.5, "USD")).toBe("−$12.50");
  });

  it("pct keeps the sign", () => {
    expect(pct(3.5)).toBe("+3.50%");
    expect(pct(-2)).toBe("-2.00%");
  });
});

describe("settlement", () => {
  it("gross = amount ÷ rate; deductions = gross × (buffer + export cost)%", () => {
    const m = settlement({
      amountNgn: 1_331_620,
      recvRate: 1331.62,
      bufferPct: 2,
      exportCostPct: 5,
    });
    expect(m.gross).toBeCloseTo(1000, 6);
    expect(m.buffer).toBeCloseTo(20, 6);
    expect(m.exportCosts).toBeCloseTo(50, 6);
    expect(m.deductions).toBeCloseTo(70, 6);
    expect(m.net).toBeCloseTo(930, 6);
    expect(m.shortfall).toBe(false);
  });

  it("clamps the buffer into 1.0–5.0 even if the caller passes out-of-range values", () => {
    // gross = 133,162 ÷ 1,331.62 = 100 → a clamped 5% buffer is 5, not 99.
    const m = settlement({ amountNgn: 133_162, recvRate: 1331.62, bufferPct: 99, exportCostPct: 0 });
    expect(m.buffer).toBeCloseTo(5, 6);
    expect(m.net).toBeCloseTo(95, 6);
    const low = settlement({ amountNgn: 133_162, recvRate: 1331.62, bufferPct: 0, exportCostPct: 0 });
    expect(low.buffer).toBeCloseTo(1, 6);
  });

  it("flags a shortfall when deductions exceed the gross", () => {
    const m = settlement({ amountNgn: 1331.62, recvRate: 1331.62, bufferPct: 5, exportCostPct: 100 });
    expect(m.shortfall).toBe(true);
    expect(m.net).toBe(0);
  });

  it("a zero amount or missing rate returns zeroes, never NaN on screen", () => {
    const empty = settlement({ amountNgn: 0, recvRate: 1331.62, bufferPct: 2, exportCostPct: 0 });
    expect(empty).toMatchObject({ gross: 0, net: 0, shortfall: false });
    const noRate = settlement({ amountNgn: 5000, recvRate: 0, bufferPct: 2, exportCostPct: 0 });
    expect(noRate).toMatchObject({ gross: 0, net: 0 });
  });
});

describe("buildSlip", () => {
  const input = {
    reference: "EXP-1234",
    generatedAt: "2026-10-20T14:05:00+01:00",
    sendCode: "NGN",
    sendAmount: 601690,
    recvCode: "USD",
    recvRate: 1331.62,
    rateNote: "Live · Exchange Rate API, 20 Oct 2026",
    bufferPct: 2,
    exportCostPct: 5,
    metrics: settlement({
      amountNgn: 601690,
      recvRate: 1331.62,
      bufferPct: 2,
      exportCostPct: 5,
    }),
    accountLabel: "My USD account",
    chartCode: "USD",
    inspectedDate: "15 Oct 2026",
    inspectedRate: 1320.11,
    inspectedChangeDay: -0.42,
    inspectedChangeWindow: 1.8,
    windowLow: 1290.4,
    windowHigh: 1340.9,
    windowMean: 1315.2,
  };

  it("carries the rate, provenance, deductions and inspected point", () => {
    const slip = buildSlip(input);
    expect(slip).toContain("EXP-1234");
    expect(slip).toContain("1 USD = NGN 1,331.62");
    expect(slip).toContain("Live · Exchange Rate API, 20 Oct 2026");
    expect(slip).toContain("NET REALIZED RECOVERY");
    expect(slip).toContain("My USD account");
    expect(slip).toContain("15 Oct 2026");
    expect(slip).toContain("+1.80%");
    expect(slip).toContain("No sample or demonstration numbers are used.");
  });

  it("warns on the slip when the settlement is below break-even", () => {
    const m = settlement({ amountNgn: 1331.62, recvRate: 1331.62, bufferPct: 5, exportCostPct: 100 });
    const slip = buildSlip({ ...input, metrics: m });
    expect(slip).toContain("below break-even");
  });

  it("reads 'Unassigned' with no destination account", () => {
    const slip = buildSlip({ ...input, accountLabel: null });
    expect(slip).toContain("Unassigned");
  });
});
