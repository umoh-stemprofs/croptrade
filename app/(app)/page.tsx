// Dashboard (04-croptrade.md screen 2): 4 stat cards — total stock value in naira,
// the same value in USD, today's USD rate (with its badge and "Old rate" tag) and the
// loading window — then the weather, maize and rates cards with their badges, then
// the two stock value charts (bar + pie). The FX attribution lives in the rates card.

import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { listStock, totalStockValueKobo } from "@/lib/inventory";
import { prismaStockDb } from "@/lib/server/stockDb";
import { getMarketProvider } from "@/lib/market/provider";
import { formatDateHuman, formatNairaFromKobo, formatRate, formatUsd } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import {
  MaizeCard,
  RatesCard,
  WeatherCard,
  loadMaize,
  loadRates,
  loadWeather,
  rateRowBadge,
} from "@/components/dashboard/Cards";
import type { BadgeSpec } from "@/components/DataSourceBadge";
import { primaryButtonClass } from "@/components/ui/Field";
import { ChartSkeletonPair } from "@/components/charts/ChartSkeleton";
import { StockChartsSection } from "@/components/charts/sections";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [{ items }, prices, rates, maize, weather] = await Promise.all([
    listStock(prismaStockDb, user.id),
    getMarketProvider()
      .latestPrices()
      .catch(() => null),
    loadRates(user.id),
    loadMaize(),
    loadWeather(user.id),
  ]);

  const kgPrices = new Map(
    (prices ?? []).filter((p) => p.unit === "KG").map((p) => [p.crop, p.priceKobo])
  );
  const totalKobo = totalStockValueKobo(
    items.map((i) => ({ qtyKg: i.qtyKg, priceKobo: kgPrices.get(i.crop) ?? 0 }))
  );
  const priceDate = prices?.[0]?.date ?? null;
  const priceBadge: BadgeSpec =
    prices?.[0]?.source === "LIVE" ? { kind: "live" } : { kind: "simulated" };

  const usdRow = rates.kind === "rates" ? rates.rows.find((r) => r.quote === "USD") : undefined;
  const usdValue = usdRow ? Math.round((totalKobo / 100 / usdRow.localPerForeign) * 100) / 100 : null;
  const rateProblem =
    rates.kind === "error"
      ? rates.message
      : "No USD rate saved yet. It appears once the app has fetched or saved one.";

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold leading-10">Dashboard</h1>
          <p className="mt-1 text-base leading-6 text-muted">
            Hello, {user.name}. Here is your farm today.
          </p>
        </div>
        <Link href="/value" className={`${primaryButtonClass} sm:w-auto sm:px-6`}>
          Work out value
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total stock value"
          value={formatNairaFromKobo(totalKobo)}
          sub={
            items.length === 0
              ? "No stock yet. Add your first crop on the Stock page."
              : priceDate
                ? `As of ${formatDateHuman(priceDate)} · ${items.length} item${items.length === 1 ? "" : "s"}`
                : undefined
          }
          badge={items.length > 0 ? priceBadge : undefined}
        />
        <StatCard
          label="Same value in USD"
          value={usdRow && usdValue !== null ? formatUsd(usdValue) : "—"}
          sub={usdRow ? "At today’s rate, before export costs" : rateProblem}
          badge={usdRow ? rateRowBadge(usdRow) : undefined}
          oldRate={usdRow?.old}
        />
        <StatCard
          label="Today’s USD rate"
          value={usdRow ? `1 USD = ${formatRate(usdRow.localPerForeign)}` : "—"}
          sub={usdRow ? `Rate of ${formatDateHuman(usdRow.date)}` : rateProblem}
          badge={usdRow ? rateRowBadge(usdRow) : undefined}
          oldRate={usdRow?.old}
        />
        <StatCard
          label="Next loading window"
          value={weather.kind === "weather" ? weather.loadingMessage : "—"}
          valueSize="small"
          sub={
            weather.kind === "weather"
              ? `From the forecast for ${weather.coords.lat.toFixed(4)}, ${weather.coords.lon.toFixed(4)}`
              : weather.message
          }
          badge={weather.kind === "weather" ? weather.badge : undefined}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <WeatherCard state={weather} />
        <MaizeCard state={maize} />
        <RatesCard state={rates} />
      </div>

      <Suspense fallback={<ChartSkeletonPair />}>
        <div className="mt-6">
          <StockChartsSection userId={user.id} />
        </div>
      </Suspense>
    </>
  );
}
