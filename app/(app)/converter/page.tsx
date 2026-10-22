// Money Converter (S-CONVERT): live naira conversions against the same FX
// pipeline the Rates page uses, plus GHS/KES/ZAR/XOF cross-rated live.
//
// Nothing on this screen is seeded: rates come from the provider (or the farm's
// manual override / saved data, each badged honestly), the chart reads the real
// FxTick history, export costs are the farm's own Settings value, and the default
// amount is the farm's current stock value. When no rate exists at all the page
// shows an error with "Try again" instead of inventing a number.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { prisma } from "@/lib/db";
import { prismaStockDb } from "@/lib/server/stockDb";
import { listStock, cropLabel } from "@/lib/inventory";
import { getMarketProvider } from "@/lib/market/provider";
import { effectiveRates } from "@/lib/fx/effective";
import { fxHistory } from "@/lib/fx/history";
import { corridorRates } from "@/lib/converter/corridor";
import { FX_QUOTES } from "@/lib/config";
import { formatDateHuman } from "@/lib/format";
import { RetryButton } from "@/components/RetryButton";
import {
  Converter,
  type ConverterRate,
  type HistoryPoint,
} from "@/components/converter/Converter";

export const dynamic = "force-dynamic";

export default async function ConverterPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const farm = await prisma.farm.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const [ratesResult, corridor, settings] = await Promise.all([
    farm
      ? effectiveRates(farm.id)
      : Promise.resolve({
          ok: false as const,
          error: "No farm found for this account. Add one in Settings first.",
        }),
    corridorRates().catch(() => []),
    farm
      ? prisma.settings.findUnique({ where: { farmId: farm.id } })
      : Promise.resolve(null),
  ]);

  if (!ratesResult.ok) {
    return (
      <>
        <header className="mb-6">
          <p className="mb-1 text-label-sm uppercase tracking-wide text-accent">
            FX export liquidity terminal
          </p>
          <h1 className="font-display text-display-lg-mobile sm:text-display-lg">
            Money Converter
          </h1>
        </header>
        <section
          role="alert"
          aria-live="assertive"
          className="bg-surface-container-lowest rounded-xl border border-error/40 shadow-sm p-space-md sm:p-space-lg"
        >
          <h2 className="text-headline-sm">Rates are unavailable</h2>
          <p className="mt-1 text-base leading-6 text-muted">{ratesResult.error}</p>
          <p className="mt-2 text-sm leading-5 text-muted">
            Every rate on this page comes from the live feed.
          </p>
          <div className="mt-4">
            <RetryButton />
          </div>
        </section>
      </>
    );
  }

  // USD/EUR/GBP through the normal pipeline (live → saved → manual), corridor
  // codes cross-rated live. Manual overrides win over corridor rows as well.
  const manualByQuote = new Map(ratesResult.rates.map((row) => [row.quote, row]));
  const rates: ConverterRate[] = [];
  for (const row of ratesResult.rates) {
    rates.push({
      quote: row.quote,
      localPerForeign: row.localPerForeign,
      date: row.date,
      source: row.source,
      old: row.old,
    });
  }
  for (const row of corridor) {
    if (manualByQuote.has(row.quote)) continue;
    rates.push({
      quote: row.quote,
      localPerForeign: row.localPerForeign,
      date: row.date,
      source: "LIVE",
      old: false,
    });
  }

  // Saved FxTick history per quote (oldest first) for the volatility chart.
  const quotesWithHistory = [...new Set([...FX_QUOTES, ...corridor.map((row) => row.quote)])];
  const historyRows = await Promise.all(
    quotesWithHistory.map((quote) => fxHistory(quote, 30).catch(() => []))
  );
  const history: Record<string, HistoryPoint[]> = {};
  quotesWithHistory.forEach((quote, index) => {
    history[quote] = [...historyRows[index]]
      .reverse()
      .map((row) => ({
        date: row.date,
        localPerForeign: row.localPerForeign,
        source: row.source,
      }));
  });

  // Default amount: the farm's current stock value at live prices, when priced.
  let defaultAmountNgn: number | null = null;
  try {
    const [{ items }, prices] = await Promise.all([
      listStock(prismaStockDb, user.id),
      getMarketProvider()
        .latestPrices()
        .catch(() => null),
    ]);
    if (prices && items.length > 0) {
      const kgPrices = new Map(
        prices.filter((row) => row.unit === "KG").map((row) => [row.crop, row.priceKobo])
      );
      const totalKobo = items.reduce((sum, item) => {
        const price = kgPrices.get(item.crop);
        return price ? sum + Math.round(item.qtyKg * price) : sum;
      }, 0);
      if (totalKobo > 0) defaultAmountNgn = Math.round(totalKobo / 100);
    }
    // cropLabel is imported for parity with the dashboard section; the converter
    // shows naira totals only, so labels are not needed here.
    void cropLabel;
  } catch {
    defaultAmountNgn = null;
  }

  const exportCostPct = settings?.exportCostPct ?? 0;
  const usd = rates.find((row) => row.quote === "USD");

  return (
    <>
      <header className="mb-space-lg flex flex-col lg:flex-row lg:items-end lg:justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm mb-1">
            <span className="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">
              currency_exchange
            </span>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary">
              FX export liquidity terminal
            </span>
          </div>
          <h1 className="font-display text-display-lg-mobile sm:text-display-lg text-on-surface tracking-tight">
            Money Converter
          </h1>
          <p className="mt-1 font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
            Convert a harvest valuation into an export settlement, net of your handling buffer
            and the export costs you set in Settings. Rates are live; custom pairings and
            accounts are yours.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <span className="inline-flex items-center gap-1.5 rounded bg-surface-container px-2.5 py-1 font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant border border-outline-variant">
            <span className="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">
              schedule
            </span>
            1 USD = {usd ? `₦${usd.localPerForeign.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
          </span>
          {usd && usd.source !== "LIVE" ? (
            <span className="inline-flex items-center gap-1.5 rounded bg-surface-container px-2.5 py-1 font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant border border-outline-variant">
              {usd.source === "MANUAL"
                ? "Manual rate"
                : `Saved · ${formatDateHuman(usd.date)}`}
            </span>
          ) : null}
        </div>
      </header>

      <Converter
        rates={rates}
        history={history}
        exportCostPct={exportCostPct}
        defaultAmountNgn={defaultAmountNgn}
      />
    </>
  );
}
