// Crop Prices Today — the Google Stitch crop_prices_today page. The server
// streams the live WFP/HDX feed; MarketExplorer renders the prototype's
// commodity cards, trend-chart accordion, filters and records table with real
// records only. If the feed fails there is no fallback data: the error state
// says what broke and offers "Try again". The prototype's "Live" badge and
// simulated context strip are removed; the currency mode converts with the
// real open.er-api.com rate.

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { loadMarketFeed, seriesFor, MarketFeedError, type MarketFeed } from "@/lib/market/wfp";
import { addDaysIso } from "@/lib/time";
import {
  MarketExplorer,
  type MarketSeriesPoint,
  type MarketView,
} from "@/components/market/MarketExplorer";
import { MarketSkeleton } from "@/components/market/MarketSkeleton";
import { TryAgainButton } from "@/components/market/TryAgainButton";
import { loadRates } from "@/components/dashboard/Cards";
import { formatDateHuman } from "@/lib/format";

export const dynamic = "force-dynamic";

const HDX_DATASET_URL = "https://data.humdata.org/dataset/wfp-food-prices-for-nigeria";

export default async function MarketPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <Suspense fallback={<MarketSkeleton />}>
      <LivePrices userId={user.id} />
    </Suspense>
  );
}

/** Compact the feed into what the browser needs: quotes, 90-day series, recent rows. */
function buildView(feed: MarketFeed): MarketView {
  const series: Record<string, MarketSeriesPoint[]> = {};
  for (const quote of feed.quotes) {
    // Each crop's window ends on its own newest record: maize and garri were last
    // surveyed in 2023, and a 2026 window would simply be empty for them.
    series[quote.crop] = seriesFor(feed.observations, quote.crop, 90, quote.date);
  }

  // Rounds arrive a month apart and the newest one can be a small emergency subset,
  // so the table and filters cover the last 90 days. One row per crop+market+type+
  // date, measured prices first, keeps the payload small without losing a market.
  const windowStart = addDaysIso(feed.asOf, -89);
  const seen = new Set<string>();
  const latest = feed.observations
    .filter((row) => row.date >= windowStart && row.date <= feed.asOf)
    .sort((a, b) => b.date.localeCompare(a.date) || Number(b.actual) - Number(a.actual))
    .filter((row) => {
      const key = `${row.crop}|${row.market}|${row.priceType}|${row.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 700);

  return {
    asOf: feed.asOf,
    quotes: feed.quotes,
    series,
    latest,
    markets: [...new Set(latest.map((row) => row.market))].sort(),
    states: [...new Set(latest.map((row) => row.state))].sort(),
    rates: { USD: null, EUR: null },
  };
}

async function LivePrices({ userId }: { userId: string }) {
  let feed: MarketFeed;
  try {
    feed = await loadMarketFeed();
  } catch (error) {
    const detail =
      error instanceof MarketFeedError
        ? error.message
        : "The price service did not respond. Check the connection and try again.";
    return <PriceError detail={detail} />;
  }

  const view = buildView(feed);
  const rates = await loadRates(userId);
  if (rates.kind === "rates") {
    view.rates = {
      USD: rates.rows.find((r) => r.quote === "USD")?.localPerForeign ?? null,
      EUR: rates.rows.find((r) => r.quote === "EUR")?.localPerForeign ?? null,
    };
  }

  return (
    <>
      {/* Telemetry bar — real counts from the live feed */}
      <div className="w-full bg-surface-container-low rounded-xl px-space-md py-space-xs mb-space-lg flex flex-wrap items-center justify-between gap-space-sm shadow-sm">
        <div className="flex items-center gap-space-md text-on-surface-variant font-data-mono text-label-sm flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="uppercase tracking-wider font-bold text-on-surface">GRAIN-INDEX NGN</span>
          </div>
          <span className="text-outline-variant">•</span>
          <span>SURVEY: {feed.asOf ? formatDateHuman(feed.asOf).toUpperCase() : "AWAITING FEED"}</span>
          <span className="text-outline-variant hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            {view.latest.length.toLocaleString("en-NG")} RECORDS · {view.markets.length} MARKETS
          </span>
          <span className="text-outline-variant hidden md:inline">•</span>
          <span className="hidden md:inline">BOARD STATUS: SPOT SETTLED</span>
        </div>
        <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm">
          <span className="material-symbols-outlined text-[16px] text-primary">satellite_alt</span>
          <span>
            <a
              href={HDX_DATASET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              WFP / HDX FEED
            </a>
          </span>
        </div>
      </div>

      <MarketExplorer {...view} />
    </>
  );
}

function PriceError({ detail }: { detail: string }) {
  return (
    <section
      role="alert"
      aria-live="assertive"
      className="w-full bg-surface-container-lowest rounded-xl border border-error/40 shadow-sm px-space-lg py-space-xl text-center"
    >
      <span className="material-symbols-outlined text-[40px] text-error">error</span>
      <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold mt-space-sm">
        Live prices are unavailable
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1">{detail}</p>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
        Every price on this page comes from the live feed — nothing is substituted.
      </p>
      <div className="mt-space-md flex justify-center">
        <TryAgainButton />
      </div>
    </section>
  );
}
