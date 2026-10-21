// Crop catalog — the crops CropTrade tracks, and the WFP commodity names that map
// to each one. Prices come only from the live WFP/HDX feed (lib/market/wfp.ts);
// there are no baseline prices in this file, so nothing here can be mistaken for
// real data.
//
// `aliases` are the exact commodity strings used by the sources:
//  - HDX / WFP Nigeria CSV: "Rice (local)", "Maize (white)", "Oil (palm)", …
//  - FEWS NET marketpricefacts: "Rice (Milled)", "Cowpeas (White)", "Yams", …

export const PRICE_START_DATE = "2026-01-01";

export type PriceUnitKey = "KG" | "TRAY" | "LITRE";

export interface CatalogEntry {
  crop: string;
  label: string;
  unit: PriceUnitKey;
  /** Commodity names in the live sources that mean this crop. */
  aliases: string[];
  /**
   * false → kept so existing stock rows still resolve, but no live product maps to
   * it. The UI shows "no live price" rather than inventing a number.
   */
  live: boolean;
}

export const CATALOG: CatalogEntry[] = [
  {
    crop: "MAIZE",
    label: "Maize",
    unit: "KG",
    live: true,
    aliases: ["Maize", "Maize (white)", "Maize (yellow)", "Maize Grain (White)", "Maize Grain (Yellow)"],
  },
  {
    crop: "RICE_LOCAL",
    label: "Rice (local)",
    unit: "KG",
    live: true,
    aliases: ["Rice (local)", "Rice (Milled)", "Rice"],
  },
  {
    crop: "RICE_IMPORTED",
    label: "Rice (imported)",
    unit: "KG",
    live: true,
    aliases: ["Rice (imported)", "Rice (5% Broken)"],
  },
  {
    crop: "GARRI",
    label: "Garri",
    unit: "KG",
    live: true,
    aliases: [
      "Cassava meal (gari, white)",
      "Cassava meal (gari, yellow)",
      "Gari (White)",
      "Gari (Yellow)",
      "Gari",
      "Garri",
    ],
  },
  {
    crop: "BEANS",
    label: "Beans (cowpeas)",
    unit: "KG",
    live: true,
    aliases: ["Beans (red)", "Beans (white)", "Cowpeas", "Cowpeas (White)", "Cowpeas (Brown)"],
  },
  {
    crop: "YAM",
    label: "Yam",
    unit: "KG",
    live: true,
    aliases: ["Yam", "Yams"],
  },
  {
    crop: "TOMATO",
    label: "Tomatoes",
    unit: "KG",
    live: true,
    aliases: ["Tomatoes"],
  },
  {
    crop: "ONION",
    label: "Onions",
    unit: "KG",
    live: true,
    aliases: ["Onions"],
  },
  {
    crop: "SORGHUM",
    label: "Sorghum",
    unit: "KG",
    live: true,
    aliases: ["Sorghum", "Sorghum (Brown)", "Sorghum (White)"],
  },
  {
    crop: "MILLET",
    label: "Millet",
    unit: "KG",
    live: true,
    aliases: ["Millet", "Millet (Pearl)"],
  },
  {
    crop: "PALM_OIL",
    label: "Palm oil",
    unit: "LITRE",
    live: true,
    aliases: ["Oil (palm)", "Palm Oil (Refined)"],
  },
  // Legacy stock keys: existing InventoryItem rows may still reference these, so they
  // stay resolvable. The live source has no matching product, so they never show a price.
  { crop: "CASSAVA", label: "Cassava", unit: "KG", live: false, aliases: [] },
  { crop: "RICE_PADDY", label: "Rice (paddy)", unit: "KG", live: false, aliases: [] },
];

export function getCatalogEntry(crop: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.crop === crop);
}
