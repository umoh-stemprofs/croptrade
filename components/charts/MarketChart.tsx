"use client";

// Market page chart (S-MARKET): one crop's price over 7, 30 or 90 days, with the
// Simulated badge. Missing days are gaps. The crop and the range are switches on
// the card, so the whole chart stays one card on a phone.

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
  compactNaira,
  longDate,
  naira,
  shortDate,
  type PricePoint,
} from "@/lib/charts";
import { ChartCard } from "./ChartCard";
import { TooltipBox } from "./ChartTooltip";

export interface MarketCropSeries {
  crop: string;
  label: string;
  /** e.g. "per kg" */
  unit: string;
  series: PricePoint[]; // 90 days, oldest first
}

const RANGES = [7, 30, 90] as const;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface PriceDatum {
  date: string;
  /** naira per unit, null on a gap */
  price: number | null;
}

function PriceTooltip({
  unit,
  active,
  payload,
}: {
  unit: string;
  active?: boolean;
  payload?: Array<{ payload?: PriceDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <TooltipBox>
      <p className="font-medium text-text">{longDate(point.date)}</p>
      {point.price === null ? (
        <p className="text-muted">No price saved</p>
      ) : (
        <p className="tabular-nums text-muted">
          {naira(point.price)} {unit}
        </p>
      )}
    </TooltipBox>
  );
}

export function MarketChart({
  crops,
  badge,
}: {
  crops: MarketCropSeries[];
  badge: BadgeSpec;
}) {
  const [crop, setCrop] = useState(crops[0]?.crop ?? "MAIZE");
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const active = crops.find((row) => row.crop === crop) ?? crops[0];

  if (!active) {
    return (
      <ChartCard
        title="Price trend"
        badge={badge}
        table={{ columns: ["Date", "Price"], rows: [] }}
        empty={{
          message: "No price history is available right now.",
          action: { href: "/market", label: "Refresh prices" },
        }}
      >
        <div />
      </ChartCard>
    );
  }

  const window = active.series.slice(-days);
  const chartData: PriceDatum[] = window.map((point) => ({
    date: point.date,
    price: point.priceKobo === null ? null : point.priceKobo / 100,
  }));
  const tableRows = [...window].reverse().map((point) => [
    shortDate(point.date),
    point.priceKobo === null ? "No data" : naira(point.priceKobo / 100),
  ]);

  return (
    <ChartCard
      title={`${active.label} price, last ${days} days`}
      badge={badge}
      table={{
        columns: ["Date", `Price (${active.unit})`],
        rows: tableRows,
      }}
      note={
        window.some((point) => point.priceKobo === null)
          ? "Days with no price are gaps and say “No data” in the table."
          : "Sample prices from the app’s simulated feed."
      }
      controls={
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="market-chart-crop"
              className="block text-sm font-medium leading-5 text-muted"
            >
              Crop
            </label>
            <select
              id="market-chart-crop"
              value={active.crop}
              onChange={(event) => setCrop(event.target.value)}
              className={`mt-1 h-12 rounded-input border border-border bg-surface px-3 text-base text-text ${focusRing}`}
            >
              {crops.map((row) => (
                <option key={row.crop} value={row.crop}>
                  {row.label}
                </option>
              ))}
            </select>
          </div>
          <div role="group" aria-label="Days shown" className="flex gap-2">
            {RANGES.map((range) => {
              const isSelected = range === days;
              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => setDays(range)}
                  aria-pressed={isSelected}
                  className={`inline-flex h-12 items-center rounded-input border px-3 text-base font-semibold ${focusRing} ${
                    isSelected
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-border bg-surface text-text hover:bg-bg"
                  }`}
                >
                  {range} days
                </button>
              );
            })}
          </div>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#E4E7EC" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => shortDate(value)}
            tick={{ fontSize: 12, fill: "#475467" }}
            tickLine={false}
            axisLine={false}
            interval={Math.max(1, Math.floor(window.length / 4))}
            minTickGap={12}
          />
          <YAxis
            width={64}
            domain={["auto", "auto"]}
            tickFormatter={(value: number) => compactNaira(value)}
            tick={{ fontSize: 12, fill: "#475467" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<PriceTooltip unit={active.unit} />} />
          <Line
            type="monotone"
            dataKey="price"
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
