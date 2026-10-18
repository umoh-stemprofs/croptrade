// FX pure logic: cross-rate math and the Old rate rule.

import { describe, expect, it } from "vitest";
import { crossRate, isOldRate, FX_OLD_RATE_DAYS } from "./rates";

const usdTable: Record<string, number> = {
  USD: 1,
  NGN: 1500,
  EUR: 0.9,
  GBP: 0.75,
};

describe("crossRate (1 foreign = X local)", () => {
  it("USD against NGN is the table's NGN rate", () => {
    expect(crossRate(usdTable, "NGN", "USD")).toBe(1500);
  });

  it("divides rates[local] by rates[foreign]", () => {
    expect(crossRate(usdTable, "NGN", "EUR")).toBe(1666.6667);
    expect(crossRate(usdTable, "NGN", "GBP")).toBe(2000);
  });

  it("keeps 4 decimal places", () => {
    const rate = crossRate({ USD: 1, NGN: 1500, EUR: 0.83 }, "NGN", "EUR");
    expect(rate).toBe(1807.2289);
  });

  it("throws a one-sentence error when a rate is missing", () => {
    expect(() => crossRate({ USD: 1, NGN: 1500 }, "NGN", "JPY")).toThrow(
      "No rate available for JPY against NGN."
    );
  });

  it("throws a one-sentence error when a rate is zero", () => {
    expect(() => crossRate({ USD: 1, NGN: 1500, EUR: 0 }, "NGN", "EUR")).toThrow(
      /No rate available/
    );
  });
});

describe("isOldRate", () => {
  it("flags rates older than 7 days", () => {
    expect(isOldRate("2026-10-10", "2026-10-18")).toBe(true);
  });

  it("does not flag rates 7 days old or newer", () => {
    expect(isOldRate("2026-10-11", "2026-10-18")).toBe(false);
    expect(isOldRate("2026-10-18", "2026-10-18")).toBe(false);
  });

  it("does not flag future-dated rates", () => {
    expect(isOldRate("2026-10-19", "2026-10-18")).toBe(false);
  });

  it("uses the documented 7-day constant", () => {
    expect(FX_OLD_RATE_DAYS).toBe(7);
  });
});
