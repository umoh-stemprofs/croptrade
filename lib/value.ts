// Work out value wizard — input rules (04-croptrade.md).
// Pure Zod schemas so every step is validated on the server, one plain sentence per
// problem. The math itself lives in lib/export.ts.

import { z } from "zod";
import { FX_QUOTES } from "./config";
import { KG_CROPS, cropLabel } from "./inventory";

/** "12.5" → 12.5, "" → invalid type; keeps one clear message per problem. */
const quantityField = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
  z
    .number({ invalid_type_error: "Enter the quantity in kg as a number." })
    .finite("Enter the quantity in kg as a number.")
    .positive("Quantity must be more than 0 kg.")
);

const percentField = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
  z
    .number({ invalid_type_error: "Export cost must be a number from 0 to 100." })
    .finite("Export cost must be a number from 0 to 100.")
    .min(0, "Export cost must be between 0 and 100.")
    .max(100, "Export cost must be between 0 and 100.")
);

export const wizardStep1Schema = z.object({
  crop: z
    .string()
    .refine((value) => KG_CROPS.includes(value), "Choose a crop from your stock."),
  qtyKg: quantityField,
});
export type WizardStep1 = z.infer<typeof wizardStep1Schema>;

export const wizardResultSchema = wizardStep1Schema.extend({
  quote: z.enum(FX_QUOTES, {
    errorMap: () => ({ message: "Choose USD, EUR or GBP." }),
  }),
  exportCostPct: percentField,
});
export type WizardResultInput = z.infer<typeof wizardResultSchema>;

export function firstWizardMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export interface StockCrop {
  crop: string;
  label: string;
  qtyKg: number;
}

/** The farmer's crops aggregated for the step-1 picker, catalog order. */
export function stockCrops(items: readonly { crop: string; qtyKg: number }[]): StockCrop[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.crop, (totals.get(item.crop) ?? 0) + item.qtyKg);
  }
  return KG_CROPS.filter((crop) => totals.has(crop)).map((crop) => ({
    crop,
    label: cropLabel(crop),
    qtyKg: Math.round(totals.get(crop)! * 100) / 100,
  }));
}
