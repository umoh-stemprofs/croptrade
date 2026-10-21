"use client";

// Crop Prices Today — everything on this screen is drawn from the live WFP/HDX
// response the server just fetched. Filters narrow the same records; nothing here
// contains a default price, and an empty result says so instead of inventing one.

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
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { ChartCard } from "@/components/charts/ChartCard";
import { TooltipBox } from "@/components/charts/ChartTooltip";
import { inputClass } from "@/components/ui/Field";
import {
  compactNaira,
  longDate,
  naira,
  shortDate,
} from "@/lib/charts";
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
}

const RANGES = [7, 30, 90] as const;

/** Older than this and the crop is shown apart, as "not in the recent survey". */
const STALE_AFTER_DAYS = 120;

const unitWord: Record<string, string> = {
  KG: "kg",
  LITRE: "litre",
  TRAY: "tray",
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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

function PriceTooltip({
  unit,
  active,
  payload,
}: {
  unit: string;
  active?: boolean;
  payload?: Array<{ payload?: MarketSeriesPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <TooltipBox>
      <p className="font-medium text-text">{longDate(point.date)}</p>
      <p className="tabular-nums text-muted">
        {naira(point.priceKobo / 100)} per {unit}
      </p>
      <p className="tabular-nums text-muted">
        {point.marketCount} market{point.marketCount === 1 ? "" : "s"}
      </p>
    </TooltipBox>
  );
}

export function MarketExplorer({ asOf, quotes, series, latest, markets, states }: MarketView) {
  const colors = useChartColors();
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [marketFilter, setMarketFilter] = useState("ALL");
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [crop, setCrop] = useState(quotes[0]?.crop ?? "");

  const geoActive = stateFilter !== "ALL" || marketFilter !== "ALL";
  const needle = query.trim().toLowerCase();

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

  return (
    <div className="space-y-6">
      <ChartCard
        title={
          activeQuote
            ? `${activeQuote.label} — last ${range} days (national median)`
            : "Price trend"
        }
        badge={{ kind: "live", note: "WFP" }}
        table={{
          columns: ["Date", `Price per ${unit}`, "Markets"],
          rows: chartTable,
          note: "One row per reported date. Missing days are not filled in.",
        }}
        note={
          windowPoints.length === 0
            ? undefined
            : `${windowPoints.length} reported date${windowPoints.length === 1 ? "" : "s"} in the WFP Nigeria survey. This crop’s newest record is ${formatDateHuman(activeQuote?.date ?? asOf)}, so the range ends there.`
        }
        empty={
          windowPoints.length === 0
            ? {
                message: `The feed has no ${activeQuote?.label ?? "crop"} price in the last ${range} days. Try a longer range.`,
                action: { href: "/market", label: "Reload prices" },
              }
            : undefined
        }
        controls={
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="sm:w-56">
              <label
                htmlFor="market-chart-crop"
                className="block text-sm font-medium leading-5 text-muted"
              >
                Commodity
              </label>
              <select
                id="market-chart-crop"
                value={activeQuote?.crop ?? ""}
                onChange={(event) => setCrop(event.target.value)}
                className={inputClass}
              >
                {quotes.map((quote) => (
                  <option key={quote.crop} value={quote.crop}>
                    {quote.label}
                  </option>
                ))}
              </select>
            </div>
            <div role="group" aria-label="Range shown" className="flex gap-2">
              {RANGES.map((option) => {
                const selected = option === range;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRange(option)}
                    aria-pressed={selected}
                    className={`inline-flex h-12 items-center rounded-input border px-3 text-base font-semibold ${focusRing} ${
                      selected
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border bg-surface text-text hover:bg-bg"
                    }`}
                  >
                    {option} days
                  </button>
                );
              })}
            </div>
          </div>
        }
      >
        {moves !== null && movesPct !== null ? (
          <p
            className={`mb-2 text-sm leading-5 ${
              moves === 0 ? "text-muted" : moves > 0 ? "text-danger" : "text-success"
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
        <ResponsiveContainer width="100%" height={240}>
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
              width={64}
              domain={["auto", "auto"]}
              tickFormatter={(value: number) => compactNaira(value)}
              tick={{ fontSize: 12, fill: colors.axis }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<PriceTooltip unit={unit} />} />
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
      </ChartCard>

      {/* Filters */}
      <section
        aria-label="Filter live prices"
        className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label htmlFor="market-search" className="block text-sm font-medium leading-5 text-muted">
              Search commodity or market
            </label>
            <input
              id="market-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Maize, garri, Kano…"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="market-state" className="block text-sm font-medium leading-5 text-muted">
              State
            </label>
            <select
              id="market-state"
              value={stateFilter}
              onChange={(event) => {
                setStateFilter(event.target.value);
                setMarketFilter("ALL");
              }}
              className={inputClass}
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
            <label htmlFor="market-market" className="block text-sm font-medium leading-5 text-muted">
              Market
            </label>
            <select
              id="market-market"
              value={marketFilter}
              onChange={(event) => setMarketFilter(event.target.value)}
              className={inputClass}
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm leading-5 text-muted">
            <span className="tabular-nums">{results.length}</span> commodit
            {results.length === 1 ? "y" : "ies"} ·{" "}
            <span className="tabular-nums">{tableRows.length}</span> record
            {tableRows.length === 1 ? "" : "s"} in the last 90 days · latest survey{" "}
            {formatDateHuman(asOf)}
            {geoActive ? ` · ${marketFilter !== "ALL" ? marketFilter : stateFilter}` : ""}
          </p>
          {needle !== "" || geoActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className={`inline-flex h-12 items-center text-sm font-semibold text-accent underline underline-offset-2 ${focusRing}`}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {/* Commodity cards */}
      {results.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          <p className="text-base font-semibold">
            {quotes.length === 0
              ? "The live feed has no matching commodities right now."
              : "Nothing matches those filters."}
          </p>
          <p className="mt-1 text-base text-muted">
            {quotes.length === 0
              ? "The WFP Nigeria survey returned rows, but none mapped to the tracked staples. Try again later."
              : "Try another spelling, or clear the state and market filters."}
          </p>
          {quotes.length > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className={`mt-3 inline-flex h-12 items-center text-sm font-semibold text-accent underline underline-offset-2 ${focusRing}`}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : fresh.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          <p className="text-base font-semibold">
            No tracked staple was surveyed in the last {STALE_AFTER_DAYS} days.
          </p>
          <p className="mt-1 text-base text-muted">
            The last recorded prices are listed below, with their survey dates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fresh.map((quote) => {
            const selected = quote.crop === activeQuote?.crop;
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
                onClick={() => setCrop(quote.crop)}
                aria-pressed={selected}
                className={`rounded-card border bg-surface p-5 text-left shadow-card transition-colors hover:bg-bg ${focusRing} ${
                  selected ? "border-accent" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-base font-semibold text-text">{quote.label}</span>
                  <DataSourceBadge badge={{ kind: "live", note: "WFP" }} />
                </div>
                <p className="mt-2 text-[28px] font-bold leading-9 tabular-nums text-text">
                  {formatNairaFromKobo(quote.priceKobo)}
                  <span className="ml-1 text-sm font-medium text-muted">
                    /{unitWord[quote.unit] ?? quote.unit.toLowerCase()}
                  </span>
                </p>
                {change !== null && changePct !== null ? (
                  <p
                    className={`mt-1 text-sm leading-5 ${
                      change === 0 ? "text-muted" : change > 0 ? "text-danger" : "text-success"
                    }`}
                  >
                    <span aria-hidden="true">{change === 0 ? "•" : change > 0 ? "▲" : "▼"}</span>{" "}
                    {change === 0 ? "No change" : `${change > 0 ? "Up" : "Down"} ${Math.abs(changePct)}%`}
                    {change === 0 ? "" : " on the previous survey"}
                  </p>
                ) : (
                  <p className="mt-1 text-sm leading-5 text-muted">First survey for this crop</p>
                )}
                <p className="mt-2 text-sm leading-5 text-muted">
                  {quote.priceType} · <span className="tabular-nums">{quote.marketCount}</span>{" "}
                  market{quote.marketCount === 1 ? "" : "s"} across{" "}
                  <span className="tabular-nums">{quote.stateCount}</span> state
                  {quote.stateCount === 1 ? "" : "s"} · {formatDateHuman(quote.date)}
                </p>
                <p className="mt-1 text-sm leading-5 text-muted tabular-nums">
                  {formatNairaFromKobo(quote.minKobo)}–{formatNairaFromKobo(quote.maxKobo)} range
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Old observations stay visible, clearly labelled — never presented as today's price. */}
      {stale.length > 0 ? (
        <section className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5">
          <h2 className="text-headline-sm">Not in the recent survey</h2>
          <p className="mt-1 text-sm leading-5 text-muted">
            These staples have no record in the last {STALE_AFTER_DAYS} days, so their last
            recorded price is shown instead — with the date it was surveyed. It is not a
            current price.
          </p>
          <ul className="mt-3 divide-y divide-border">
            {stale.map((quote) => (
              <li key={quote.crop}>
                <button
                  type="button"
                  onClick={() => setCrop(quote.crop)}
                  aria-pressed={quote.crop === activeQuote?.crop}
                  className={`flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left ${focusRing}`}
                >
                  <span className="text-base font-medium text-text">{quote.label}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span className="tabular-nums">
                      {formatNairaFromKobo(quote.priceKobo)}/
                      {unitWord[quote.unit] ?? quote.unit.toLowerCase()}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-input border border-warning/30 bg-warning-bg px-2.5 py-0.5 text-sm font-medium text-warning">
                      Last surveyed · {formatDateHuman(quote.date)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Records table */}
      <section className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4 sm:p-5">
          <h2 className="text-headline-sm">Market records</h2>
          <p className="text-sm leading-5 text-muted">
            Showing <span className="tabular-nums">{Math.min(tableRows.length, 80)}</span> of{" "}
            <span className="tabular-nums">{tableRows.length}</span>
          </p>
        </div>
        {tableRows.length === 0 ? (
          <p className="p-4 text-base text-muted sm:p-5">
            No records match these filters in the last 90 days of the survey.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-border text-sm text-muted">
                <tr>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium sm:px-5">
                    Commodity
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium sm:px-5">
                    Market
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium sm:px-5">
                    State
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 font-medium sm:px-5">
                    Type
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium sm:px-5">
                    Price
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium sm:px-5">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tableRows.slice(0, 80).map((row, index) => (
                  <tr key={`${row.crop}-${row.market}-${row.priceType}-${index}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-base sm:px-5">{row.commodity}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-base sm:px-5">{row.market}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-base text-muted sm:px-5">
                      {row.state}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted sm:px-5">
                      {row.priceType}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-base font-semibold tabular-nums sm:px-5">
                      {formatNairaFromKobo(row.priceKobo)}
                      <span className="ml-1 text-xs font-normal text-muted">
                        /{unitWord[row.unit] ?? row.unit.toLowerCase()}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-muted sm:px-5">
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
