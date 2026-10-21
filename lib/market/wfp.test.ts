// The live WFP/HDX feed: unit maths, CSV parsing, commodity mapping, and the
// aggregation the screens rely on. These tests use a hand-written CSV snippet that
// mirrors the real resource's columns — the app itself ships no price data.

import { describe, expect, it } from "vitest";
import {
  buildFeed,
  cropForCommodity,
  latestQuotes,
  normalizeUnit,
  observationsFromFews,
  observationsFromWfpCsv,
  parseCsv,
  pricePerUnitKobo,
  seriesFor,
} from "./wfp";
import { WfpProvider } from "./provider";

const CSV = `date,admin1,admin2,market,market_id,commodity,commodity_id,unit,pricecurrency,price,pricetype,currency,usdprice
2026-10-15,Kano,Kano,Dawanau,DW,Maize (white),1,kg,NGN,850,Retail,NGN,0.55
2026-10-15,Kano,Kano,Dawanau,DW,Maize (white),1,kg,NGN,880,Wholesale,NGN,0.57
2026-10-15,Lagos,Ikeja,Mile 12,M12,"Cassava meal (gari, white)",2,kg,NGN,1200,Retail,NGN,0.78
2026-10-15,Lagos,Ikeja,Mile 12,M12,Garri,2,50 kg,NGN,62000,Retail,NGN,40.3
2026-10-14,Oyo,Ibadan,Bodija,BD,Maize (white),1,kg,NGN,800,Retail,NGN,0.52
2026-10-15,Oyo,Ibadan,Bodija,BD,Maize (white),1,kg,USD,2,Retail,USD,2
2026-10-13,Kano,Kano,Kurmi,KM,Rice (imported),3,kg,NGN,1500,Retail,NGN,0.98
2026-10-15,Kano,Kano,Kurmi,KM,Sorghum,4,kg,NGN,0,Retail,NGN,0
2026-10-15,Kano,Kano,Kurmi,KM,Plantain,5,kg,NGN,900,Retail,NGN,0.59`;

const SINCE = "2026-10-10";

describe("unit normalisation", () => {
  it("reads plain and pack weights", () => {
    expect(normalizeUnit("kg")).toEqual({ size: 1, unit: "KG" });
    expect(normalizeUnit("50_kg")).toEqual({ size: 50, unit: "KG" });
    expect(normalizeUnit("100 kg")).toEqual({ size: 100, unit: "KG" });
    expect(normalizeUnit("g")).toEqual({ size: 0.001, unit: "KG" });
    expect(normalizeUnit("L")).toEqual({ size: 1, unit: "LITRE" });
    expect(normalizeUnit("30_L")).toEqual({ size: 30, unit: "LITRE" });
    expect(normalizeUnit("ml")).toEqual({ size: 0.001, unit: "LITRE" });
  });

  it("refuses counts it cannot turn into a per-kg price", () => {
    expect(normalizeUnit("30 pcs")).toBeNull();
    expect(normalizeUnit("100 tubers")).toBeNull();
    expect(normalizeUnit("")).toBeNull();
  });

  it("converts a pack price to kobo per kg", () => {
    expect(pricePerUnitKobo(62_000, "50 kg", "KG")).toBe(124_000);
    expect(pricePerUnitKobo(850, "kg", "KG")).toBe(85_000);
    expect(pricePerUnitKobo(1_800, "250 g", "KG")).toBe(720_000);
    expect(pricePerUnitKobo(2_400, "L", "LITRE")).toBe(240_000);
  });

  it("rejects prices and units that do not fit the crop", () => {
    expect(pricePerUnitKobo(850, "kg", "LITRE")).toBeNull();
    expect(pricePerUnitKobo(0, "kg", "KG")).toBeNull();
    expect(pricePerUnitKobo(Number.NaN, "kg", "KG")).toBeNull();
  });
});

describe("CSV parsing", () => {
  it("keeps commas inside quoted fields", () => {
    const rows = parseCsv('a,b\n"1, 2",3\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["1, 2", "3"],
    ]);
  });

  it("maps commodity names to catalog crops", () => {
    expect(cropForCommodity("Maize (white)")).toBe("MAIZE");
    expect(cropForCommodity("maize")).toBe("MAIZE");
    expect(cropForCommodity("Cassava meal (gari, white)")).toBe("GARRI");
    expect(cropForCommodity("Gari (White)")).toBe("GARRI");
    expect(cropForCommodity("Plantain")).toBeNull();
  });
});

describe("WFP observations", () => {
  const rows = observationsFromWfpCsv(CSV, SINCE);

  it("keeps only NGN retail/wholesale rows it can price per kg", () => {
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.source === "HDX_CSV")).toBe(true);
    expect(rows.some((row) => row.commodity === "Maize (white)" && row.priceType === "Wholesale")).toBe(
      true
    );
    // USD row, zero price and untracked commodity are all dropped.
    expect(rows.every((row) => row.priceKobo > 0)).toBe(true);
  });

  it("normalises a 50 kg garri price to a per-kg price", () => {
    const garri = rows.filter((row) => row.crop === "GARRI");
    expect(garri).toHaveLength(2);
    expect(garri.every((row) => row.priceKobo === 120_000 || row.priceKobo === 124_000)).toBe(true);
  });

  it("drops rows older than the window", () => {
    const recent = observationsFromWfpCsv(CSV, "2026-10-14");
    expect(recent.some((row) => row.date === "2026-10-13")).toBe(false);
  });

  it("maps FEWS NET records with its own product names", () => {
    const fews = observationsFromFews(
      [
        {
          product: "Maize Grain (White)",
          market: "Dawanau",
          state: "Kano",
          period_date: "2026-10-15",
          value: 900,
          unit: "kg",
        },
        {
          product: "Yams",
          market: "Mile 12",
          state: "Lagos",
          period_date: "2026-10-15",
          value: 120_000,
          unit: "100 kg",
        },
      ],
      SINCE
    );
    expect(fews).toHaveLength(2);
    expect(fews[0]).toMatchObject({ crop: "MAIZE", priceKobo: 90_000, source: "FEWS_NET" });
    expect(fews[1]).toMatchObject({ crop: "YAM", priceKobo: 120_000 });
  });
});

describe("aggregation", () => {
  const observations = observationsFromWfpCsv(CSV, SINCE);

  it("takes the retail median on the newest date with its previous value", () => {
    const maize = latestQuotes(observations).find((quote) => quote.crop === "MAIZE");
    expect(maize).toBeDefined();
    expect(maize!.date).toBe("2026-10-15");
    expect(maize!.priceKobo).toBe(85_000);
    expect(maize!.priceType).toBe("Retail");
    expect(maize!.previousKobo).toBe(80_000);
    expect(maize!.marketCount).toBe(1);
    expect(maize!.stateCount).toBe(1);
    // The range follows the same retail rows as the median, so the wholesale quote
    // in that market does not widen it.
    expect(maize!.minKobo).toBe(85_000);
    expect(maize!.maxKobo).toBe(85_000);
  });

  it("sorts quotes by price, most expensive first", () => {
    const prices = latestQuotes(observations).map((quote) => quote.priceKobo);
    expect([...prices].sort((a, b) => b - a)).toEqual(prices);
  });

  it("counts each market once and prefers a measured price over an aggregate", () => {
    const csv = `date,admin1,market,commodity,unit,pricetype,currency,price,priceflag
2026-10-15,Kano,Dawanau,Maize (white),kg,Retail,NGN,850,actual
2026-10-15,Kano,Dawanau,Maize (white),kg,Retail,NGN,999,aggregate
2026-10-15,Kano,Kurmi,Maize (white),kg,Retail,NGN,900,actual
2026-10-15,Kano,Kurmi,Maize (white),kg,Wholesale,NGN,700,actual`;
    const quote = latestQuotes(observationsFromWfpCsv(csv, SINCE))[0];
    expect(quote.priceKobo).toBe(87_500);
    expect(quote.minKobo).toBe(85_000);
    expect(quote.maxKobo).toBe(90_000);
    expect(quote.marketCount).toBe(2);
    expect(quote.priceType).toBe("Retail");
  });

  it("builds one series point per reported date only", () => {
    const series = seriesFor(observations, "MAIZE", 7, "2026-10-15");
    expect(series).toEqual([
      { date: "2026-10-14", priceKobo: 80_000, marketCount: 1 },
      { date: "2026-10-15", priceKobo: 85_000, marketCount: 1 },
    ]);
  });

  it("leaves out dates outside the requested range", () => {
    const series = seriesFor(observations, "MAIZE", 1, "2026-10-15");
    expect(series.map((point) => point.date)).toEqual(["2026-10-15"]);
  });

  it("labels the feed with its newest date and real sources", () => {
    const feed = buildFeed(observations);
    expect(feed.asOf).toBe("2026-10-15");
    expect(feed.sources).toEqual(["HDX_CSV"]);
  });
});

describe("provider — live only, no fallback", () => {
  const feed = buildFeed(observationsFromWfpCsv(CSV, SINCE));

  it("maps quotes to MarketPrice rows marked LIVE", async () => {
    const provider = new WfpProvider(async () => feed);
    const rows = await provider.latestPrices();
    expect(rows.length).toBe(feed.quotes.length);
    expect(rows.every((row) => row.source === "LIVE")).toBe(true);
    const maize = rows.find((row) => row.crop === "MAIZE");
    expect(maize).toEqual({
      crop: "MAIZE",
      date: "2026-10-15",
      priceKobo: 85_000,
      unit: "KG",
      source: "LIVE",
    });
  });

  it("anchors history on the newest observation, not today", async () => {
    const provider = new WfpProvider(async () => feed);
    const history = await provider.history("MAIZE", 7);
    expect(history.map((row) => row.date)).toEqual(["2026-10-14", "2026-10-15"]);
  });

  it("rejects unknown crops and bad ranges instead of returning samples", async () => {
    const provider = new WfpProvider(async () => feed);
    await expect(provider.history("PLANTAIN", 7)).rejects.toThrow(/Unknown crop/);
    await expect(provider.history("MAIZE", 0)).rejects.toThrow(/Days must be/);
    await expect(provider.history("MAIZE", 91)).rejects.toThrow(/Days must be/);
  });

  it("propagates a feed failure — there is no simulated price table to fall back to", async () => {
    const provider = new WfpProvider(async () => {
      throw new Error("network down");
    });
    await expect(provider.latestPrices()).rejects.toThrow("network down");
  });
});
