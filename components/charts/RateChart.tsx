"use client";

// Rates page chart (04-croptrade.md screen 6): one line per currency, switchable
// between USD, EUR and GBP. Days with no saved rate are gaps — the line never
// bridges or invents one. The tooltip names the source of every point
// (Live, Saved data, Simulated, Manual).

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BadgeSpec } from "@/components/DataSourceBadge";
import {
  SERIES_COLORS,
  longDate,
  naira,
  nairaExact,
  shortDate,
  sourceWord,
  type RatePoint,
} from "@/lib/charts";
import { ChartCard } from "./ChartCard";
import { TooltipBox } from "./ChartTooltip";

export interface RateChartQuote {
  quote: string;
  badge: BadgeSpec;
  series: RatePoint[];
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function RateTooltip({
  quote,
  active,
  payload,
}: {
  quote: string;
  active?: boolean;
  payload?: Array<{ payload?: RatePoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <TooltipBox>
      <p className="font-medium text-text">{longDate(point.date)}</p>
      {point.rate === null ? (
        <p className="text-muted">No rate saved</p>
      ) : (
        <>
          <p className="tabular-nums text-text">
            1 {quote} = {nairaExact(point.rate)}
          </p>
          <p className="text-muted">{sourceWord(point.source)}</p>
        </>
      )}
    </TooltipBox>
  );
}

export function RateChart({ quotes }: { quotes: RateChartQuote[] }) {
  const [selected, setSelected] = useState(quotes[0]?.quote ?? "USD");
  const active = quotes.find((row) => row.quote === selected) ?? quotes[0];

  if (!active) {
    return (
      <ChartCard
        title="Rate, last 30 days"
        table={{ columns: ["Date", "Rate", "Source"], rows: [] }}
        empty={{
          message: "No exchange rates are saved yet.",
          action: { href: "/rates/change?quote=USD", label: "Set a rate" },
        }}
      >
        <div />
      </ChartCard>
    );
  }

  const tableRows = [...active.series].reverse().map((point) => [
    shortDate(point.date),
    point.rate === null ? "No data" : nairaExact(point.rate),
    point.rate === null ? "No data" : sourceWord(point.source),
  ]);

  return (
    <ChartCard
      title={`${active.quote} rate, last 30 days`}
      badge={active.badge}
      table={{ columns: ["Date", "1 " + active.quote + " in naira", "Source"], rows: tableRows }}
      note="Days with no saved rate are gaps. The tooltip names each point’s source."
      controls={
        quotes.length > 1 ? (
          <div role="group" aria-label="Currency" className="flex flex-wrap gap-2">
            {quotes.map((row) => {
              const isSelected = row.quote === active.quote;
              return (
                <button
                  key={row.quote}
                  type="button"
                  onClick={() => setSelected(row.quote)}
                  aria-pressed={isSelected}
                  className={`inline-flex h-12 items-center rounded-input border px-4 text-base font-semibold ${focusRing} ${
                    isSelected
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-border bg-surface text-text hover:bg-bg"
                  }`}
                >
                  {row.quote}
                </button>
              );
            })}
          </div>
        ) : undefined
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={active.series}
          margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
        >
          <CartesianGrid stroke="#E4E7EC" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => shortDate(value)}
            tick={{ fontSize: 12, fill: "#475467" }}
            tickLine={false}
            axisLine={false}
            interval={Math.max(1, Math.floor(active.series.length / 4))}
            minTickGap={12}
          />
          <YAxis
            width={64}
            domain={["auto", "auto"]}
            tickFormatter={(value: number) => naira(value)}
            tick={{ fontSize: 12, fill: "#475467" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<RateTooltip quote={active.quote} />} />
          <Line
            type="monotone"
            dataKey="rate"
            stroke={SERIES_COLORS[0]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
