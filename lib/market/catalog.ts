// Crop catalog for the simulated market feed (00-global §3).
// Sample ₦ prices — PLACEHOLDERS to be reviewed against local markets before real use.

export const PRICE_START_DATE = "2026-01-01"; // generator epoch

export type PriceUnitKey = "KG" | "TRAY" | "LITRE";

export interface CatalogEntry {
  crop: string;
  label: string;
  /** ₦ per unit baseline */
  base: number;
  unit: PriceUnitKey;
  /** per-crop salt for the deterministic generator (chosen so that today at least one crop rises and one falls) */
  salt: string;
}

export const CATALOG: CatalogEntry[] = [
  { crop: "MAIZE", label: "Maize", base: 600, unit: "KG", salt: "mz-a7" },
  { crop: "CASSAVA", label: "Cassava", base: 350, unit: "KG", salt: "cs-b3" },
  { crop: "YAM", label: "Yam", base: 900, unit: "KG", salt: "ym-c9" },
  { crop: "RICE_PADDY", label: "Rice (paddy)", base: 850, unit: "KG", salt: "rp-d2" },
  { crop: "TOMATO", label: "Tomato", base: 700, unit: "KG", salt: "tm-e5" },
  { crop: "TILAPIA", label: "Tilapia", base: 2500, unit: "KG", salt: "tl-f4" },
  { crop: "CATFISH", label: "Catfish", base: 2800, unit: "KG", salt: "cf-g8" },
  { crop: "EGGS_TRAY", label: "Eggs (tray of 30)", base: 3800, unit: "TRAY", salt: "eg-h1" },
  { crop: "PALM_OIL", label: "Palm oil", base: 1800, unit: "LITRE", salt: "po-i6" },
];

export function getCatalogEntry(crop: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.crop === crop);
}
