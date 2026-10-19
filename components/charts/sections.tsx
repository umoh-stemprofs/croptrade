// Async chart sections (server). Each one loads only what its chart needs and is
// rendered inside <Suspense> by the page, so the page streams a skeleton first and
// the chart appears when its numbers are ready. No client secrets, no database
// handles cross to the browser — only plain rows and badge specs.

import { listStock, cropLabel } from "@/lib/inventory";
import { prismaStockDb } from "@/lib/server/stockDb";
import { getMarketProvider } from "@/lib/market/provider";
import { getCatalogEntry } from "@/lib/market/catalog";
import { effectiveRates } from "@/lib/fx/effective";
import { fxHistory } from "@/lib/fx/history";
import { FX_QUOTES } from "@/lib/config";
import { todayIso } from "@/lib/time";
import { formatDateShort } from "@/lib/format";
import { rateRowBadge } from "@/components/dashboard/Cards";
import type { BadgeSpec } from "@/components/DataSourceBadge";
import type { ValuationRow } from "@/lib/valuations";
import {
  pieSlices,
  priceSeries,
  rateSeries,
  stockValueByCrop,
  valuationBars,
} from "@/lib/charts";
import { StockCharts } from "./StockCharts";
import { RateChart, type RateChartQuote } from "./RateChart";
import { MarketChart, type MarketCropSeries } from "./MarketChart";
import { ValuationChart } from "./ValuationChart";

const unitWord: Record<string, string> = {
  KG: "per kg",
  TRAY: "per tray of 30",
  LITRE: "per litre",
};

/** Dashboard: "Stock value by crop" + "Share of stock value". */
export async function StockChartsSection({ userId }: { userId: string }) {
  const [{ items }, prices] = await Promise.all([
    listStock(prismaStockDb, userId),
    getMarketProvider()
      .latestPrices()
      .catch(() => null),
  ]);

  const kgPrices = new Map(
    (prices ?? []).filter((row) => row.unit === "KG").map((row) => [row.crop, row.priceKobo])
  );
  const slices = stockValueByCrop(
    items.map((item) => ({
      crop: item.crop,
      qtyKg: item.qtyKg,
      priceKobo: kgPrices.get(item.crop) ?? 0,
    })),
    cropLabel
  );
  const badge: BadgeSpec =
    prices?.[0]?.source === "LIVE" ? { kind: "live" } : { kind: "simulated" };

  return <StockCharts slices={slices} pie={pieSlices(slices)} badge={badge} />;
}

/** Rates: one 30-day series per currency (gaps stay gaps). */
export async function RatesChartSection({ farmId }: { farmId: string | null }) {
  if (!farmId) return <RateChart quotes={[]} />;

  const rates = await effectiveRates(farmId);
  if (!rates.ok) return <RateChart quotes={[]} />;

  const today = todayIso();
  const histories = await Promise.all(
    FX_QUOTES.map((quote) => fxHistory(quote, 30).catch(() => []))
  );
  const byQuote = new Map(rates.rates.map((row) => [row.quote, row]));

  const quotes: RateChartQuote[] = FX_QUOTES.flatMap((quote, index) => {
    const row = byQuote.get(quote);
    if (!row) return [];
    return [
      {
        quote,
        badge: rateRowBadge(row),
        series: rateSeries(histories[index], {
          days: 30,
          today,
          current: {
            date: row.date,
            localPerForeign: row.localPerForeign,
            source: row.source,
          },
        }),
      },
    ];
  });

  return <RateChart quotes={quotes} />;
}

/** Market: 90 days of prices per crop; the card switches crop and 7/30/90 days. */
export async function MarketChartSection() {
  const provider = getMarketProvider();
  const latest = await provider.latestPrices().catch(() => []);
  const histories = await Promise.all(
    latest.map((row) => provider.history(row.crop, 90).catch(() => []))
  );
  const today = todayIso();

  const crops: MarketCropSeries[] = latest
    .map((row, index) => ({
      crop: row.crop,
      label: getCatalogEntry(row.crop)?.label ?? row.crop,
      unit: unitWord[row.unit] ?? `per ${row.unit.toLowerCase()}`,
      series: priceSeries(histories[index], { days: 90, today }),
    }))
    // A crop with no saved price would draw an empty chart — leave it out so the
    // card can show its empty state instead of a blank grid.
    .filter((row) => row.series.some((point) => point.priceKobo !== null));
  const badge: BadgeSpec =
    latest[0]?.source === "LIVE" ? { kind: "live" } : { kind: "simulated" };

  return <MarketChart crops={crops} badge={badge} />;
}

/** Valuations: net per saved valuation, one currency at a time. */
export function ValuationsChartSection({ rows }: { rows: ValuationRow[] }) {
  const bars = valuationBars(rows, cropLabel);
  const badge: BadgeSpec = {
    kind: "saved",
    ageLabel: rows[0] ? formatDateShort(rows[0].date) : "today",
  };
  return <ValuationChart bars={bars} badge={badge} />;
}
