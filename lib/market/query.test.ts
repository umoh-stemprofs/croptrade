// Bad input to /api/market/history must give one sentence saying what to fix.

import { describe, expect, it } from "vitest";
import { HISTORY_DEFAULT_DAYS, parseHistoryParams } from "./query";

const q = (s: string) => parseHistoryParams(new URLSearchParams(s));

describe("market history query validation", () => {
  it("accepts a valid crop and days", () => {
    expect(q("crop=MAIZE&days=30")).toEqual({ ok: true, crop: "MAIZE", days: 30 });
  });

  it("defaults days to 30", () => {
    expect(q("crop=MAIZE")).toEqual({ ok: true, crop: "MAIZE", days: HISTORY_DEFAULT_DAYS });
  });

  it("rejects a missing crop with one sentence", () => {
    const result = q("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/crop/i);
  });

  it("rejects an unknown crop with one sentence", () => {
    const result = q("crop=COCONUT");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("COCONUT");
  });

  it.each(["0", "91", "-5", "3.5", "abc"])("rejects bad days=%s with one sentence", (days) => {
    const result = q(`crop=MAIZE&days=${days}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/whole number from 1 to 90/);
  });

  it("accepts the boundaries 1 and 90", () => {
    expect(q("crop=MAIZE&days=1").ok).toBe(true);
    expect(q("crop=MAIZE&days=90").ok).toBe(true);
  });
});
