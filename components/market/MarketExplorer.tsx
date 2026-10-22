"use client";

// Crop Prices Today — the Google Stitch crop_prices_today page. Everything on
// this screen is drawn from the live WFP/HDX response the server just fetched;
// filters narrow the same records; nothing here contains a default price, and
// an empty result says so instead of inventing one. The prototype's "Live"
// badge is removed per request; the currency mode converts with the real
// open.er-api.com rate and stays disabled for a currency with no rate.

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TooltipBox } from "@/components/charts/ChartTooltip";
import { compactNaira, longDate, naira, shortDate } from "@/lib/charts";
import { formatDateHuman, formatNairaFromKobo } from "@/lib/format";
import { seriesSpanDays, windowSeries } from "@/lib/market/window";
import { useChartColors } from "@/lib/theme";
import type { CropQuote, LiveObservation } from "@/lib/market/wfp";

export interface MarketSeriesPoint {
  date: string;
  priceKobo: number;
  marketCount: number;
}

export interface MarketView {
  asOf: string;
  quotes: CropQuote[];
  /** Daily median per crop, newest last — covers the widest range (90 days). */
  series: Record<string, MarketSeriesPoint[]>;
  /** Every record on the newest date, for the table and the market/state filters. */
  latest: LiveObservation[];
  markets: string[];
  states: string[];
  /** Live open.er-api.com rates, "1 USD = X NGN". null → the toggle stays off. */
  rates: { USD: number | null; EUR: number | null };
}

const RANGES = [7, 30, 90] as const;

/** Older than this and the crop is shown apart, as "not in the recent survey". */
const STALE_AFTER_DAYS = 120;

const unitWord: Record<string, string> = {
  KG: "kg",
  LITRE: "litre",
  TRAY: "tray",
};

const ICONS: Record<string, string> = {
  MAIZE: "grain",
  RICE_LOCAL: "rice_bowl",
  RICE_PARBOILED: "rice_bowl",
  CASSAVA: "nutrition",
  YAM: "agriculture",
  TOMATO: "nutrition",
  SOYBEAN: "eco",
  GROUNDNUT: "grain",
  PALM_OIL: "water_drop",
  GINGER: "eco",
  SESAME: "grain",
  SORGHUM: "grass",
  MILLET: "grass",
  COWPEA: "eco",
  PLANTAIN: "eco",
};

const CARD_TONES = [
  { icon: "text-primary", chip: "bg-primary/10 text-primary" },
  { icon: "text-secondary", chip: "bg-secondary/10 text-secondary" },
  { icon: "text-tertiary-strong", chip: "bg-tertiary/12 text-tertiary-strong" },
  { icon: "text-primary-container", chip: "bg-primary-container/10 text-primary-container" },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const fieldCls =
  "h-9 px-2 rounded bg-surface-container-lowest border border-outline-variant text-body-sm text-on-surface";

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

type Currency = "NGN" | "USD" | "EUR";

export function MarketExplorer({ asOf, quotes, series, latest, markets, states, rates }: MarketView) {
  const colors = useChartColors();
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [marketFilter, setMarketFilter] = useState("ALL");
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [crop, setCrop] = useState(quotes[0]?.crop ?? "");
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [trendOpen, setTrendOpen] = useState(true);

  const geoActive = stateFilter !== "ALL" || marketFilter !== "ALL";
  const needle = query.trim().toLowerCase();

  /** "₦586" / "$0.44" — naira in, converted out with the live rate. */
  function money(ngn: number): string {
    if (currency === "NGN") return naira(ngn);
    const rate = currency === "USD" ? rates.USD : rates.EUR;
    if (!rate || rate <= 0) return "—";
    return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-IE", {
      style: "currency",
      currency,
    }).format(ngn / rate);
  }

  const marketOptions = useMemo(() => {
    const pool =
      stateFilter === "ALL" ? latest : latest.filter((row) => row.state === stateFilter);
    return [...new Set(pool.map((row) => row.market))].sort();
  }, [latest, stateFilter]);

  const filteredRows = useMemo(
    () =>
      latest.filter(
        (row) =>
          (stateFilter === "ALL" || row.state === stateFilter) &&
          (marketFilter === "ALL" || row.market === marketFilter)
      ),
    [latest, stateFilter, marketFilter]
  );

  const results = useMemo(() => {
    return quotes.flatMap((quote) => {
      const own = filteredRows.filter((row) => row.crop === quote.crop);
      const textHit =
        needle === "" ||
        quote.label.toLowerCase().includes(needle) ||
        quote.crop.toLowerCase().includes(needle) ||
        own.some((row) =>
          `${row.commodity} ${row.market} ${row.state}`.toLowerCase().includes(needle)
        );
      if (!textHit) return [];
      // A market/state filter means "show only what trades there"; a crop with no
      // record in that market is left out rather than showing its national average.
      if (geoActive && own.length === 0) return [];
      const priceKobo = geoActive ? median(own.map((row) => row.priceKobo)) : quote.priceKobo;
      return [
        {
          ...quote,
          priceKobo,
          marketCount: geoActive ? new Set(own.map((row) => row.market)).size : quote.marketCount,
          previousKobo: geoActive ? null : quote.previousKobo,
        },
      ];
    });
  }, [quotes, filteredRows, needle, geoActive]);

  const tableRows = useMemo(() => {
    return filteredRows
      .filter(
        (row) =>
          needle === "" ||
          `${row.commodity} ${row.market} ${row.state}`.toLowerCase().includes(needle)
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          a.crop.localeCompare(b.crop) ||
          a.market.localeCompare(b.market) ||
          a.priceKobo - b.priceKobo
      );
  }, [filteredRows, needle]);

  // Crops whose newest record is old are kept apart: their price is real, but it is
  // not "today's" price and must never look like one.
  const fresh = results.filter(
    (quote) => daysBetween(quote.date, asOf) <= STALE_AFTER_DAYS
  );
  const stale = results.filter((quote) => daysBetween(quote.date, asOf) > STALE_AFTER_DAYS);

  const activeQuote = quotes.find((quote) => quote.crop === crop) ?? quotes[0];
  const activeSeries = activeQuote ? (series[activeQuote.crop] ?? []) : [];
  // Slice by the survey timestamps, anchored on this crop's newest record —
  // a point-count slice would show a three-month-old date under "last 7 days".
  const windowPoints = windowSeries(activeSeries, activeQuote?.date ?? asOf, range);
  const unit = activeQuote ? (unitWord[activeQuote.unit] ?? activeQuote.unit.toLowerCase()) : "kg";
  const first = windowPoints[0]?.priceKobo ?? null;
  const last = windowPoints[windowPoints.length - 1]?.priceKobo ?? null;
  // A single reported date is not a trend; say nothing rather than "Flat".
  const moves =
    windowPoints.length >= 2 && first !== null && last !== null && first > 0
      ? last - first
      : null;
  const spanDays = seriesSpanDays(windowPoints);
  const movesPct = moves !== null && first ? Math.round((moves / first) * 1000) / 10 : null;

  const chartData = windowPoints.map((point) => ({
    date: point.date,
    price: Math.round(point.priceKobo) / 100,
  }));
  const chartTable = [...windowPoints].reverse().map((point) => [
    shortDate(point.date),
    naira(point.priceKobo / 100),
    `${point.marketCount} market${point.marketCount === 1 ? "" : "s"}`,
  ]);

  function clearFilters() {
    setQuery("");
    setStateFilter("ALL");
    setMarketFilter("ALL");
  }

  const currencyDisabled = (code: Currency) =>
    code !== "NGN" && (!rates[code] || rates[code]! <= 0);

  return (
    <div className="flex flex-col w-full">
      {/* ── Header section (prototype hero) ─────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-xl">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-container/15 text-primary text-label-sm font-label-sm mb-space-xs uppercase tracking-wider">
            Spot Exchange Desk
          </div>
          <h1 className="font-display text-display-lg-mobile sm:text-display-lg text-on-surface tracking-tight">
            Crop Prices Today
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-1 max-w-2xl">
            Live commodity benchmark rates calibrated across physical terminal silos and regional
            marketing boards.
          </p>
        </div>
        <div className="bg-surface-container px-space-md py-space-sm rounded-xl flex items-center gap-space-sm shadow-sm self-start">
          <span className="material-symbols-outlined text-[20px] text-secondary" aria-hidden="true">
            currency_exchange
          </span>
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Currency Mode</span>
            <div className="flex items-center gap-1 mt-0.5" role="group" aria-label="Display currency for all prices">
              {(["NGN", "USD", "EUR"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  disabled={currencyDisabled(code)}
                  title={
                    currencyDisabled(code)
                      ? `No ${code} rate saved yet — set it on the Rates page.`
                      : undefined
                  }
                  onClick={() => setCurrency(code)}
                  aria-pressed={currency === code}
                  className={`px-2 py-0.5 rounded font-label-md text-label-md font-bold border transition-colors ${focusRing} ${
                    currency === code
                      ? "bg-primary-container text-on-primary-container border-transparent shadow-sm"
                      : "bg-surface-container-lowest border-outline-variant text-on-surface hover:bg-surface-container-high"
                  } ${currencyDisabled(code) ? "opacity-45 cursor-not-allowed" : ""}`}
                >
                  {code === "NGN" ? "₦" : code === "USD" ? "$" : "€"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Commodity cards (4-card primary grid) ─────────────────────── */}
      {results.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm px-space-lg py-space-xl text-center mb-space-xl">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant">search_off</span>
          <p className="font-headline-sm text-headline-sm text-on-surface font-bold mt-space-sm">
            {quotes.length === 0
              ? "The live feed has no matching commodities right now."
              : "Nothing matches those filters."}
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {quotes.length === 0
              ? "The WFP Nigeria survey returned rows, but none mapped to the tracked staples. Try again later."
              : "Try another spelling, or clear the state and market filters."}
          </p>
          {quotes.length > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className={`mt-space-md h-9 px-space-md rounded bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md font-semibold shadow-sm transition-colors ${focusRing}`}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : fresh.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm px-space-lg py-space-xl text-center mb-space-xl">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant">history</span>
          <p className="font-headline-sm text-headline-sm text-on-surface font-bold mt-space-sm">
            No tracked staple was surveyed in the last {STALE_AFTER_DAYS} days.
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            The last recorded prices are listed below, with their survey dates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-xl">
          {fresh.map((quote, index) => {
            const selected = quote.crop === activeQuote?.crop;
            const tone = CARD_TONES[index % CARD_TONES.length];
            const change =
              quote.previousKobo !== null ? quote.priceKobo - quote.previousKobo : null;
            const changePct =
              quote.previousKobo !== null && quote.previousKobo > 0
                ? Math.round(((quote.priceKobo - quote.previousKobo) / quote.previousKobo) * 1000) / 10
                : null;
            return (
              <button
                key={quote.crop}
                type="button"
                onClick={() => {
                  setCrop(quote.crop);
                  setTrendOpen(true);
                }}
                aria-pressed={selected}
                className={`bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between relative overflow-hidden group text-left transition-transform duration-200 hover:-translate-y-0.5 ${focusRing} ${
                  selected ? "border border-primary/50" : "border border-outline-variant"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-space-sm">
                    <div className="flex items-center gap-space-xs min-w-0">
                      <span className={`material-symbols-outlined text-[20px] ${tone.icon}`} aria-hidden="true">
                        {ICONS[quote.crop] ?? "payments"}
                      </span>
                      <span className="font-title-md text-title-md text-on-surface truncate">{quote.label}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-label-sm font-label-sm font-semibold flex items-center gap-1 shrink-0 ${tone.chip}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {formatDateHuman(quote.date)}
                    </span>
                  </div>
                  <div className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight my-1 tabular-nums">
                    {money(quote.priceKobo / 100)}{" "}
                    <span className="font-body-md text-body-md text-on-surface-variant font-normal">
                      / {unitWord[quote.unit] ?? quote.unit.toLowerCase()}
                    </span>
                  </div>
                  {change !== null && changePct !== null ? (
                    <div
                      className={`inline-flex items-center gap-1 font-label-md text-label-md font-semibold mb-space-md ${
                        change === 0 ? "text-on-surface-variant" : change > 0 ? "text-primary" : "text-error"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                        {change === 0 ? "remove" : change > 0 ? "arrow_upward" : "arrow_downward"}
                      </span>
                      <span>
                        {change === 0 ? "Flat" : change > 0 ? "Up" : "Down"}{" "}
                        {change === 0 ? "" : `${Math.abs(changePct).toFixed(1)}%`}
                      </span>
                      <span className="text-on-surface-variant font-normal text-body-sm">(previous survey)</span>
                    </div>
                  ) : (
                    <p className="font-label-md text-label-md text-on-surface-variant mb-space-md">
                      First survey for this crop
                    </p>
                  )}
                </div>
                <div className="pt-space-sm bg-surface-container-low/70 -mx-space-md -mb-space-md px-space-md py-space-sm rounded-b-xl flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">
                      Benchmark Basis
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
                      {quote.priceType} · {quote.marketCount} market{quote.marketCount === 1 ? "" : "s"} ·{" "}
                      {quote.stateCount} state{quote.stateCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0">
                    chevron_right
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <section
        aria-label="Filter live prices"
        className="w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-md mb-space-lg"
      >
        <div className="flex flex-col lg:flex-row lg:items-end gap-space-md">
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor="market-search"
              className="block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant mb-1"
            >
              Search commodity or market
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none">
                search
              </span>
              <input
                id="market-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Maize, garri, Kano…"
                className="w-full h-9 pl-10 pr-3 rounded bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface placeholder:text-outline"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-space-sm">
            <div>
              <label htmlFor="market-state" className="block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant mb-1">
                State
              </label>
              <select
                id="market-state"
                value={stateFilter}
                onChange={(event) => {
                  setStateFilter(event.target.value);
                  setMarketFilter("ALL");
                }}
                className={fieldCls}
              >
                <option value="ALL">All states ({states.length})</option>
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="market-market" className="block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant mb-1">
                Market
              </label>
              <select
                id="market-market"
                value={marketFilter}
                onChange={(event) => setMarketFilter(event.target.value)}
                className={fieldCls}
              >
                <option value="ALL">All markets ({marketOptions.length})</option>
                {marketOptions.map((market) => (
                  <option key={market} value={market}>
                    {market}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="h-9 px-space-md rounded border border-outline-variant bg-surface-container-lowest hover:bg-surface-container font-label-md text-label-md text-on-surface flex items-center justify-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
            <span>Clear</span>
          </button>
        </div>
        <p className="mt-space-md font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5" role="status">
          <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
          <span>
            <span className="tabular-nums">{results.length}</span> commodit
            {results.length === 1 ? "y" : "ies"} · <span className="tabular-nums">{tableRows.length}</span> record
            {tableRows.length === 1 ? "" : "s"} in the last 90 days · latest survey {formatDateHuman(asOf)}
            {geoActive ? ` · ${marketFilter !== "ALL" ? marketFilter : stateFilter}` : ""}
          </span>
        </p>
      </section>

      {/* ── Trend chart accordion ─────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant mb-space-lg overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setTrendOpen((value) => !value)}
          aria-expanded={trendOpen}
          aria-controls="market-trend-panel"
          className="w-full min-h-[56px] px-space-lg py-space-md flex items-center justify-between text-left bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-space-md">
            <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                show_chart
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-space-md">
              <span className="font-title-md text-title-md text-on-surface font-bold">
                {range}-Day Price Trend Chart
              </span>
              <span className="text-on-surface-variant font-label-md text-label-md">
                {activeQuote ? `${activeQuote.label} — national median` : "Comparative benchmark"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm text-primary font-title-md text-title-md font-semibold">
            <span className="hidden sm:inline">{trendOpen ? "Tap to hide" : "Tap to view"}</span>
            <span className={`material-symbols-outlined transition-transform duration-300 ${trendOpen ? "rotate-180" : ""}`} aria-hidden="true">
              expand_more
            </span>
          </div>
        </button>

        <div id="market-trend-panel" className={`${trendOpen ? "" : "hidden"} px-space-lg py-space-xl bg-surface-container-lowest`}>
          {/* Chart controls */}
          <div className="flex flex-wrap items-center justify-between gap-space-md pb-space-md mb-space-md border-b border-outline-variant">
            <div className="flex flex-col sm:flex-row sm:items-center gap-space-sm">
              <label
                htmlFor="market-chart-crop"
                className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant"
              >
                Commodity
              </label>
              <select
                id="market-chart-crop"
                value={activeQuote?.crop ?? ""}
                onChange={(event) => setCrop(event.target.value)}
                className={fieldCls}
              >
                {quotes.map((quote) => (
                  <option key={quote.crop} value={quote.crop}>
                    {quote.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-xl" role="group" aria-label="Chart time range">
              {RANGES.map((option) => {
                const selected = option === range;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRange(option)}
                    aria-pressed={selected}
                    className={`px-3 py-1 rounded-lg font-label-md text-label-md font-semibold transition-colors ${focusRing} ${
                      selected
                        ? "bg-primary-container text-on-primary-container shadow-sm"
                        : "text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {option}D
                  </button>
                );
              })}
            </div>
          </div>

          {windowPoints.length === 0 ? (
            <div className="py-space-xl text-center">
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant">show_chart</span>
              <p className="font-title-md text-title-md text-on-surface font-semibold mt-1">No points in this range</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                The feed has no {activeQuote?.label ?? "crop"} price in the last {range} days. Try a longer range.
              </p>
            </div>
          ) : (
            <>
              {moves !== null && movesPct !== null ? (
                <p
                  className={`mb-2 font-body-sm text-body-sm ${
                    moves === 0 ? "text-on-surface-variant" : moves > 0 ? "text-primary" : "text-error"
                  }`}
                >
                  <span aria-hidden="true">{moves === 0 ? "•" : moves > 0 ? "▲" : "▼"}</span>{" "}
                  {moves === 0 ? "Flat" : moves > 0 ? "Up" : "Down"}{" "}
                  <span className="tabular-nums">
                    {naira(Math.abs(moves) / 100)} ({Math.abs(movesPct)}%)
                  </span>{" "}
                  over {spanDays} day{spanDays === 1 ? "" : "s"}
                </p>
              ) : null}
              <div className="w-full overflow-x-auto">
                <div className="min-w-[560px]">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value: string) => shortDate(value)}
                        tick={{ fontSize: 12, fill: colors.axis }}
                        tickLine={false}
                        axisLine={false}
                        interval={Math.max(1, Math.floor(chartData.length / 5))}
                        minTickGap={12}
                      />
                      <YAxis
                        width={72}
                        domain={["auto", "auto"]}
                        tickFormatter={(value: number) =>
                          currency === "NGN" ? compactNaira(value) : money(value)
                        }
                        tick={{ fontSize: 12, fill: colors.axis }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<PriceTooltip unit={unit} money={money} />} />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke={colors.series[0]}
                        strokeWidth={2}
                        dot={{ r: 2.5, strokeWidth: 0, fill: colors.series[0] }}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="mt-space-md pt-space-md flex flex-wrap items-center justify-between gap-space-sm text-body-sm font-body-sm text-on-surface-variant border-t border-outline-variant">
                <span>
                  {windowPoints.length} reported date{windowPoints.length === 1 ? "" : "s"} in the WFP Nigeria
                  survey. Missing days are not filled in.
                </span>
                <span className="font-data-mono text-data-mono">
                  NEWEST RECORD: {formatDateHuman(activeQuote?.date ?? asOf).toUpperCase()}
                </span>
              </div>
              <details className="mt-space-sm">
                <summary className={`cursor-pointer font-label-sm text-label-sm uppercase tracking-wider text-primary ${focusRing}`}>
                  View data table
                </summary>
                <div className="mt-space-sm overflow-x-auto">
                  <table className="w-full text-left font-body-md text-body-md border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                        <th scope="col" className="py-space-sm px-space-md font-bold">Date</th>
                        <th scope="col" className="py-space-sm px-space-md font-bold">Price per {unit}</th>
                        <th scope="col" className="py-space-sm px-space-md font-bold">Markets</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartTable.map(([d, p, m], index) => (
                        <tr key={`${d}-${index}`} className="border-b border-outline-variant/60">
                          <td className="py-space-sm px-space-md tabular-nums">{d}</td>
                          <td className="py-space-sm px-space-md tabular-nums">{p}</td>
                          <td className="py-space-sm px-space-md tabular-nums">{m}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </div>
      </div>

      {/* Old observations stay visible, clearly labelled — never presented as today's price. */}
      {stale.length > 0 ? (
        <section className="w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-md mb-space-lg">
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Not in the recent survey</h2>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            These staples have no record in the last {STALE_AFTER_DAYS} days, so their last recorded price
            is shown instead — with the date it was surveyed. It is not a current price.
          </p>
          <ul className="mt-space-sm divide-y divide-outline-variant">
            {stale.map((quote) => (
              <li key={quote.crop}>
                <button
                  type="button"
                  onClick={() => setCrop(quote.crop)}
                  aria-pressed={quote.crop === activeQuote?.crop}
                  className={`flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left ${focusRing}`}
                >
                  <span className="font-title-md text-title-md text-on-surface font-medium">{quote.label}</span>
                  <span className="flex flex-wrap items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
                    <span className="tabular-nums">
                      {formatNairaFromKobo(quote.priceKobo)}/{unitWord[quote.unit] ?? quote.unit.toLowerCase()}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded bg-tertiary/15 text-tertiary-strong px-2.5 py-0.5 font-label-sm text-label-sm font-semibold">
                      Last surveyed · {formatDateHuman(quote.date)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── Records table ─────────────────────────────────────────────── */}
      <section className="w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden mb-space-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-low px-space-lg py-space-md">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-secondary text-[22px]" aria-hidden="true">
              table_view
            </span>
            <h2 className="font-title-md text-title-md text-on-surface font-bold">Market records</h2>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant tabular-nums">
            Showing {Math.min(tableRows.length, 80)} of {tableRows.length}
          </p>
        </div>
        {tableRows.length === 0 ? (
          <p className="p-space-lg font-body-md text-body-md text-on-surface-variant text-center">
            No records match these filters in the last 90 days of the survey.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-body-md text-body-md border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest border-b border-outline-variant text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th scope="col" className="py-space-sm px-space-md font-bold">Commodity</th>
                  <th scope="col" className="py-space-sm px-space-md font-bold">Market</th>
                  <th scope="col" className="py-space-sm px-space-md font-bold">State</th>
                  <th scope="col" className="py-space-sm px-space-md font-bold">Type</th>
                  <th scope="col" className="py-space-sm px-space-md font-bold text-right">Price</th>
                  <th scope="col" className="py-space-sm px-space-md rounded-r-lg font-bold text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(0, 80).map((row, index) => (
                  <tr
                    key={`${row.crop}-${row.market}-${row.priceType}-${index}`}
                    className={`${index % 2 === 1 ? "bg-surface-container-lowest" : "bg-surface-container-low/40"} hover:bg-surface-container-low/60 transition-colors`}
                  >
                    <td className="py-space-sm px-space-md font-semibold">{row.commodity}</td>
                    <td className="py-space-sm px-space-md">{row.market}</td>
                    <td className="py-space-sm px-space-md text-on-surface-variant">{row.state}</td>
                    <td className="py-space-sm px-space-md font-body-sm text-body-sm text-on-surface-variant">{row.priceType}</td>
                    <td className="py-space-sm px-space-md text-right font-data-mono font-bold tabular-nums">
                      {money(row.priceKobo / 100)}
                      <span className="ml-1 text-xs font-normal text-on-surface-variant">
                        /{unitWord[row.unit] ?? row.unit.toLowerCase()}
                      </span>
                    </td>
                    <td className="py-space-sm px-space-md text-right font-body-sm text-body-sm tabular-nums text-on-surface-variant">
                      {formatDateHuman(row.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PriceTooltip({
  unit,
  money,
  active,
  payload,
}: {
  unit: string;
  money: (ngn: number) => string;
  active?: boolean;
  payload?: Array<{ payload?: MarketSeriesPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <TooltipBox>
      <p className="font-medium text-on-surface">{longDate(point.date)}</p>
      <p className="tabular-nums text-on-surface-variant">
        {money(point.priceKobo / 100)} per {unit}
      </p>
      <p className="tabular-nums text-on-surface-variant">
        {point.marketCount} market{point.marketCount === 1 ? "" : "s"}
      </p>
    </TooltipBox>
  );
}
