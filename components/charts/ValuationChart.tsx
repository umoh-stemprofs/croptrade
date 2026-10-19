"use client";

// Saved valuations chart (04-croptrade.md screen 5): net export value per saved
// valuation, oldest first. Currencies are never added together, so a currency
// switch keeps the axis honest when a farm has saved more than one.

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BadgeSpec } from "@/components/DataSourceBadge";
import {
  SERIES_COLORS,
  compactMoney,
  longDate,
  money,
  shortDate,
  type ValuationBar,
} from "@/lib/charts";
import { ChartCard } from "./ChartCard";
import { TooltipBox } from "./ChartTooltip";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface BarDatum {
  id: string;
  name: string;
  crop: string;
  date: string;
  value: number;
}

function ValuationTooltip({
  quote,
  active,
  payload,
}: {
  quote: string;
  active?: boolean;
  payload?: Array<{ payload?: BarDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const bar = payload[0]?.payload;
  if (!bar) return null;
  return (
    <TooltipBox>
      <p className="font-medium text-text">{bar.name}</p>
      <p className="text-muted">{longDate(bar.date)}</p>
      <p className="tabular-nums text-text">
        {money(bar.value, quote)} net in {quote}
      </p>
    </TooltipBox>
  );
}

export function ValuationChart({
  bars,
  badge,
}: {
  bars: ValuationBar[];
  badge: BadgeSpec;
}) {
  const quotes = [...new Set(bars.map((bar) => bar.quote))];
  const [selected, setSelected] = useState(quotes[0] ?? "USD");
  const active = bars.filter((bar) => bar.quote === selected);

  if (bars.length === 0) {
    return (
      <ChartCard
        title="Net export value per saved valuation"
        badge={badge}
        table={{ columns: ["Date", "Crop", "Net value"], rows: [] }}
        empty={{
          message: "Save a valuation to see it drawn against the others.",
          action: { href: "/value", label: "Work out value" },
        }}
      >
        <div />
      </ChartCard>
    );
  }

  // Oldest at the bottom when the switch selects a currency with one bar.
  const chartData: BarDatum[] = active.map((bar) => ({
    id: bar.id,
    name: `${bar.label} · ${shortDate(bar.date)}`,
    crop: bar.label,
    date: bar.date,
    value: bar.netForeign,
  }));
  const tableRows = [...active].reverse().map((bar) => [
    shortDate(bar.date),
    bar.label,
    money(bar.netForeign, bar.quote),
  ]);

  return (
    <ChartCard
      title="Net export value per saved valuation"
      badge={badge}
      table={{ columns: ["Date", "Crop", "Net value"], rows: tableRows }}
      note="Net after export costs. Currencies are never added together."
      controls={
        quotes.length > 1 ? (
          <div role="group" aria-label="Currency" className="flex flex-wrap gap-2">
            {quotes.map((quote) => {
              const isSelected = quote === selected;
              return (
                <button
                  key={quote}
                  type="button"
                  onClick={() => setSelected(quote)}
                  aria-pressed={isSelected}
                  className={`inline-flex h-12 items-center rounded-input border px-4 text-base font-semibold ${focusRing} ${
                    isSelected
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-border bg-surface text-text hover:bg-bg"
                  }`}
                >
                  {quote}
                </button>
              );
            })}
          </div>
        ) : undefined
      }
    >
      <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 52 + 24)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
          barCategoryGap={10}
        >
          <CartesianGrid horizontal={false} stroke="#E4E7EC" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickFormatter={(value: number) => compactMoney(value, selected)}
            tick={{ fontSize: 12, fill: "#475467" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 12, fill: "#101828" }}
            tickFormatter={(value: string) =>
              value.length > 18 ? `${value.slice(0, 17)}…` : value
            }
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ValuationTooltip quote={selected} />} cursor={{ fill: "#F7F8FA" }} />
          <Bar
            dataKey="value"
            fill={SERIES_COLORS[2]}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
