// Stat card (design.md §2: label, big number, small note, optional data-source badge).

import type { ReactNode } from "react";
import { DataSourceBadge, type BadgeSpec } from "./DataSourceBadge";

export function StatCard({
  label,
  value,
  sub,
  badge,
  oldRate,
  valueSize = "big",
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  badge?: BadgeSpec;
  /** show the orange "Old rate" tag (it still calculates) */
  oldRate?: boolean;
  valueSize?: "big" | "small";
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-medium leading-6 text-muted">{label}</h2>
        {badge ? <DataSourceBadge badge={badge} /> : null}
      </div>
      <p
        className={
          valueSize === "big"
            ? "mt-3 text-[32px] font-bold leading-10 tabular-nums"
            : "mt-3 text-[20px] font-semibold leading-7"
        }
      >
        {value}
      </p>
      {sub ? <p className="mt-2 text-sm leading-5 text-muted">{sub}</p> : null}
      {oldRate ? (
        <p className="mt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-bg px-2.5 py-0.5 text-sm font-medium leading-5 text-warning">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            Old rate
          </span>
        </p>
      ) : null}
    </section>
  );
}
