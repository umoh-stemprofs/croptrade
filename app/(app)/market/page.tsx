// Market (S-MARKET): a crop price chart (7 / 30 / 90 days), then a card per crop
// with today's price, the change since yesterday (color + arrow + word — never
// color alone) and the data-source badge.

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { getMarketProvider } from "@/lib/market/provider";
import { CATALOG, getCatalogEntry } from "@/lib/market/catalog";
import { formatNairaFromKobo } from "@/lib/format";
import { DataSourceBadge, type BadgeSpec } from "@/components/DataSourceBadge";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { MarketChartSection } from "@/components/charts/sections";

export const dynamic = "force-dynamic";

const unitWord: Record<string, string> = {
  KG: "per kg",
  TRAY: "per tray of 30",
  LITRE: "per litre",
};

export default async function MarketPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const provider = getMarketProvider();
  const latest = await provider.latestPrices().catch(() => []);
  const histories = await Promise.all(
    latest.map((row) => provider.history(row.crop, 2).catch(() => []))
  );

  const cards = latest.map((row, i) => {
    const history = histories[i];
    const previous = history.length >= 2 ? history[history.length - 2].priceKobo : null;
    const changeKobo = previous !== null ? row.priceKobo - previous : null;
    const changePct =
      previous !== null && previous > 0
        ? Math.round(((row.priceKobo - previous) / previous) * 1000) / 10
        : null;
    const badge: BadgeSpec = row.source === "LIVE" ? { kind: "live" } : { kind: "simulated" };
    return {
      crop: row.crop,
      label: getCatalogEntry(row.crop)?.label ?? row.crop,
      priceKobo: row.priceKobo,
      unit: unitWord[row.unit] ?? `per ${row.unit.toLowerCase()}`,
      changeKobo,
      changePct,
      badge,
    };
  });

  return (
    <>
      <header className="mb-6">
        <h1 className="text-[32px] font-bold leading-10">Market</h1>
        <p className="mt-1 text-base leading-6 text-muted">
          Today’s prices from the app’s simulated live feed, with the change since yesterday.
        </p>
      </header>

      <div className="mb-6">
        <Suspense fallback={<ChartSkeleton />}>
          <MarketChartSection />
        </Suspense>
      </div>

      {cards.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-base text-muted shadow-card">
          Prices are unavailable right now. Try again in a few minutes.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <section
              key={card.crop}
              className="rounded-card border border-border bg-surface p-6 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-base font-medium leading-6 text-muted">{card.label}</h2>
                <DataSourceBadge badge={card.badge} />
              </div>
              <p className="mt-3 text-[32px] font-bold leading-10 tabular-nums">
                {formatNairaFromKobo(card.priceKobo)}
                <span className="ml-2 text-base font-medium text-muted">{card.unit}</span>
              </p>
              {card.changeKobo !== null && card.changePct !== null ? (
                card.changeKobo === 0 ? (
                  <p className="mt-2 text-sm leading-5 text-muted">No change since yesterday</p>
                ) : (
                  <p
                    className={`mt-2 text-sm leading-5 ${
                      card.changeKobo > 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    <span aria-hidden="true">{card.changeKobo > 0 ? "▲" : "▼"}</span>{" "}
                    {card.changeKobo > 0 ? "Up" : "Down"}{" "}
                    {formatNairaFromKobo(Math.abs(card.changeKobo))} ({Math.abs(card.changePct)}%)
                    since yesterday
                  </p>
                )
              ) : (
                <p className="mt-2 text-sm leading-5 text-muted">No history yet for today</p>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
