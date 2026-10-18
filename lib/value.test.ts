// Wizard input rules and the step-1 crop picker.

import { describe, expect, it } from "vitest";
import { firstWizardMessage, stockCrops, wizardResultSchema, wizardStep1Schema } from "./value";

describe("wizardStep1Schema", () => {
  it("accepts a crop from the catalog and a decimal kg string", () => {
    const parsed = wizardStep1Schema.safeParse({ crop: "MAIZE", qtyKg: "12.5" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.qtyKg).toBe(12.5);
  });

  it("rejects 0, negative and empty quantities with one sentence", () => {
    for (const qtyKg of ["0", "-4", "", "abc"]) {
      const parsed = wizardStep1Schema.safeParse({ crop: "MAIZE", qtyKg });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(firstWizardMessage(parsed.error)).toMatch(/quantity|number/i);
    }
  });

  it("rejects a crop that is not stockable in kg", () => {
    expect(wizardStep1Schema.safeParse({ crop: "EGGS_TRAY", qtyKg: "2" }).success).toBe(false);
  });
});

describe("wizardResultSchema", () => {
  const base = { crop: "YAM", qtyKg: "100", quote: "USD", exportCostPct: "10" };

  it("accepts a full result query", () => {
    const parsed = wizardResultSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ qtyKg: 100, exportCostPct: 10 });
  });

  it("rejects a currency outside USD, EUR, GBP", () => {
    expect(wizardResultSchema.safeParse({ ...base, quote: "JPY" }).success).toBe(false);
  });

  it("rejects export costs outside 0..100", () => {
    expect(wizardResultSchema.safeParse({ ...base, exportCostPct: "-1" }).success).toBe(false);
    expect(wizardResultSchema.safeParse({ ...base, exportCostPct: "101" }).success).toBe(false);
  });
});

describe("stockCrops", () => {
  it("adds duplicate rows for the same crop", () => {
    const crops = stockCrops([
      { crop: "MAIZE", qtyKg: 100 },
      { crop: "MAIZE", qtyKg: 25.5 },
      { crop: "YAM", qtyKg: 40 },
    ]);
    expect(crops).toEqual([
      { crop: "MAIZE", label: "Maize", qtyKg: 125.5 },
      { crop: "YAM", label: "Yam", qtyKg: 40 },
    ]);
  });

  it("ignores crops that are not stocked in kg (tray, litre)", () => {
    const crops = stockCrops([
      { crop: "EGGS_TRAY", qtyKg: 3 },
      { crop: "PALM_OIL", qtyKg: 20 },
    ]);
    expect(crops).toEqual([]);
  });
});
