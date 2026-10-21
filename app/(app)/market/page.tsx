// Crop Prices Today (S-MARKET): live WFP/HDX prices for Nigerian staples.
//
// The page streams a skeleton while the feed loads, then renders real records only.
// If the feed fails there is no fallback data: the error state says what broke and
// offers "Try again". Range, search and market/state filters work on the fetched
// records — nothing is generated in the browser.

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { loadMarketFeed, seriesFor, MarketFeedError, type MarketFeed } from "@/lib/market/wfp";
import { addDaysIso } from "@/lib/time";
import { MARKET_SOURCE_LABEL } from "@/lib/market/provider";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import {
  MarketExplorer,
  type MarketSeriesPoint,
  type MarketView,
} from "@/components/market/MarketExplorer";
import { MarketSkeleton } from "@/components/market/MarketSkeleton";
import { TryAgainButton } from "@/components/market/TryAgainButton";
import { formatDateHuman } from "@/lib/format";

export const dynamic = "force-dynamic";

const HDX_DATASET_URL = "https://data.humdata.org/dataset/wfp-food-prices-for-nigeria";

export default async function MarketPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="mb-6">
        <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-label-sm uppercase tracking-wider text-accent">
          Spot exchange desk
        </p>
        <h1 className="font-display text-display-lg-mobile sm:text-display-lg">
          Crop Prices Today
        </h1>
        <p className="mt-1 max-w-3xl text-base leading-6 text-muted">
          Retail and wholesale prices for Nigerian staples from the World Food Programme’s
          market survey, fetched live — search, filter by market or state, and change the range
          without reloading.
        </p>
      </header>

      <Suspense fallback={<MarketSkeleton />}>
        <LivePrices />
      </Suspense>
    </>
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
  };
}

async function LivePrices() {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <DataSourceBadge badge={{ kind: "live", note: MARKET_SOURCE_LABEL }} />
        <p className="text-sm leading-5 text-muted">
          {feed.asOf ? (
            <>
              Newest survey: <span className="tabular-nums">{formatDateHuman(feed.asOf)}</span> ·{" "}
            </>
          ) : null}
          <span className="tabular-nums">{view.latest.length.toLocaleString("en-NG")}</span> records
          from <span className="tabular-nums">{view.markets.length}</span> markets across{" "}
          <span className="tabular-nums">{view.states.length}</span> state
          {view.states.length === 1 ? "" : "s"} in the last 90 days ·{" "}
          <a
            href={HDX_DATASET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2"
          >
            WFP Food Prices for Nigeria (HDX)
          </a>
        </p>
      </div>
      <MarketExplorer {...view} />
    </div>
  );
}

function PriceError({ detail }: { detail: string }) {
  return (
    <section
      role="alert"
      aria-live="assertive"
      className="rounded-card border border-danger/30 bg-surface p-6 shadow-card"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M12 8v5" />
            <path d="M12 16.5h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 className="text-headline-sm">Live prices are unavailable</h2>
          <p className="mt-1 text-base leading-6 text-muted">{detail}</p>
          <p className="mt-2 text-sm leading-5 text-muted">
            Every price on this page comes from the live feed.
          </p>
          <div className="mt-4">
            <TryAgainButton />
          </div>
        </div>
      </div>
    </section>
  );
}
