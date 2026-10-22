// Dashboard — the Google Stitch farm_overview page. The server loads stock,
// WFP market prices, the FX rate and the Open-Meteo forecast, then hands plain
// serialisable data to the client Overview panel.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { listStock, totalStockValueKobo } from "@/lib/inventory";
import { prismaStockDb } from "@/lib/server/stockDb";
import { getMarketProvider } from "@/lib/market/provider";
import { loadRates, loadWeather } from "@/components/dashboard/Cards";
import { Overview, type OverviewCrop } from "@/components/dashboard/Overview";

export const dynamic = "force-dynamic";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** "UTC 08:42 · WK41.RII" — live clock + ISO-8601 week, as the prototype shows. */
function tradingCycle(now: Date): string {
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const weekday = (now.getUTCDay() + 6) % 7; // Monday = 0
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  date.setUTCDate(date.getUTCDate() - weekday + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604_800_000);
  return `UTC ${hh}:${mm} · WK${week}.R${ROMAN[weekday]}`;
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [{ items }, prices, rates, weather] = await Promise.all([
    listStock(prismaStockDb, user.id),
    getMarketProvider()
      .latestPrices()
      .catch(() => null),
    loadRates(user.id),
    loadWeather(user.id),
  ]);

  const kgPrices = new Map(
    (prices ?? []).filter((p) => p.unit === "KG").map((p) => [p.crop, p.priceKobo])
  );
  const priceDate = prices?.[0]?.date ?? null;

  const byCrop = new Map<string, OverviewCrop>();
  for (const item of items) {
    const entry = byCrop.get(item.crop) ?? {
      crop: item.crop,
      qtyKg: 0,
      valueKobo: 0,
      priceKobo: kgPrices.get(item.crop) ?? null,
      lots: [] as { qtyKg: number; note: string | null }[],
    };
    entry.qtyKg += item.qtyKg;
    entry.valueKobo += Math.round(item.qtyKg * (kgPrices.get(item.crop) ?? 0));
    entry.lots.push({ qtyKg: item.qtyKg, note: item.note });
    byCrop.set(item.crop, entry);
  }
  const crops = [...byCrop.values()].sort((a, b) => b.valueKobo - a.valueKobo);
  const totalKobo = totalStockValueKobo(
    items.map((i) => ({ qtyKg: i.qtyKg, priceKobo: kgPrices.get(i.crop) ?? 0 }))
  );

  const usdRow = rates.kind === "rates" ? rates.rows.find((r) => r.quote === "USD") : undefined;

  return (
    <Overview
      crops={crops}
      totalKobo={totalKobo}
      priceDate={priceDate}
      usdRate={usdRow?.localPerForeign ?? null}
      usdRateDate={usdRow?.date ?? null}
      usdRateOld={usdRow?.old ?? false}
      tradingCycle={tradingCycle(new Date())}
      weather={
        weather.kind === "weather"
          ? {
              coords: weather.coords,
              defaultLocation: weather.defaultLocation,
              tempC: weather.tempC,
              text: weather.text,
              humidity: weather.humidity,
              windKmh: weather.windKmh,
              pressureHpa: weather.pressureHpa,
              daily: weather.daily,
              barometric: weather.barometric,
            }
          : null
      }
      weatherError={weather.kind === "error" ? weather.message : null}
    />
  );
}
