"use client";

// Dashboard charts (S-DASH): stock value by crop (bar, naira) and the share of
// stock value (pie, max 5 slices — the rest are "Other"). Numbers are the same as
// the stock page: qtyKg × latest price per kg. Charts are one series each, so they
// stay readable at 390 px.

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BadgeSpec } from "@/components/DataSourceBadge";
import {
  MAX_PIE_SLICES,
  compactNaira,
  naira,
  type PieSlice,
  type StockValueSlice,
} from "@/lib/charts";
import { useChartColors } from "@/lib/theme";
import { ChartCard } from "./ChartCard";
import { TooltipBox } from "./ChartTooltip";

interface BarDatum {
  name: string;
  value: number; // naira
}

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <TooltipBox>
      <p className="font-medium text-text">{label}</p>
      <p className="tabular-nums text-muted">{naira(Number(payload[0]?.value ?? 0))}</p>
    </TooltipBox>
  );
}

function PieTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  const share = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <TooltipBox>
      <p className="font-medium text-text">{payload[0]?.name}</p>
      <p className="tabular-nums text-muted">
        {naira(value)} · {share}% of stock value
      </p>
    </TooltipBox>
  );
}

export function StockCharts({
  slices,
  pie,
  badge,
}: {
  slices: StockValueSlice[];
  pie: PieSlice[];
  badge: BadgeSpec;
}) {
  const colors = useChartColors();
  const barData: BarDatum[] = slices.map((slice) => ({
    name: slice.label,
    value: slice.valueKobo / 100,
  }));
  const pieData = pie.map((slice) => ({
    name: slice.name,
    value: slice.valueKobo / 100,
  }));
  const total = pieData.reduce((sum, slice) => sum + slice.value, 0);
  const empty = barData.length === 0;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <ChartCard
        title="Stock value by crop"
        badge={badge}
        table={{
          columns: ["Crop", "Value"],
          rows: slices.map((slice) => [slice.label, naira(slice.valueKobo / 100)]),
          note: "Values in naira at today’s price.",
        }}
        empty={
          empty
            ? {
                message: "Add stock to see what each crop is worth.",
                action: { href: "/stock", label: "Add stock" },
              }
            : undefined
        }
        note="Values in naira at today’s price."
      >
        <ResponsiveContainer width="100%" height={Math.max(180, barData.length * 52 + 24)}>
          <BarChart
            data={barData}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
            barCategoryGap={10}
          >
            <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickFormatter={(value: number) => compactNaira(value)}
              tick={{ fontSize: 12, fill: colors.axis }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={96}
              tick={{ fontSize: 12, fill: colors.text }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: colors.hover }} />
            <Bar
              dataKey="value"
              fill={colors.series[0]}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Share of stock value"
        badge={badge}
        table={{
          columns: ["Crop", "Value", "Share"],
          rows: pie.map((slice) => [
            slice.name,
            naira(slice.valueKobo / 100),
            `${Math.round((slice.valueKobo / Math.max(1, slices.reduce((sum, s) => sum + s.valueKobo, 0))) * 100)}%`,
          ]),
          note:
            slices.length > MAX_PIE_SLICES
              ? "The four biggest crops; the rest are grouped as Other."
              : "Values in naira at today’s price.",
        }}
        empty={
          empty
            ? {
                message: "Add stock to see how your value is shared between crops.",
                action: { href: "/stock", label: "Add stock" },
              }
            : undefined
        }
        note={
          slices.length > MAX_PIE_SLICES
            ? "The four biggest crops; the rest are grouped as Other."
            : "Percentages are of your total stock value."
        }
      >
        <div className="flex flex-col items-center gap-3 lg:flex-row lg:items-center lg:gap-6">
          <div className="h-[200px] w-full max-w-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke={colors.surface}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={colors.series[index % colors.series.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex w-full flex-col gap-2">
            {pieData.map((entry, index) => (
              <li key={entry.name} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: colors.series[index % colors.series.length] }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-text">{entry.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {total > 0 ? Math.round((entry.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </ChartCard>
    </div>
  );
}
