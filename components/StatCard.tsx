// KPI tile — the Stitch prototype's metric card (agroexecutive_tactical_canvas):
// label-sm uppercase header with an optional source flag, a 40px extrabold
// tabular readout, body-sm context, and an inset footer strip for the Old-rate tag.

import type { ReactNode } from "react";
import { DataSourceBadge, OldRateTag, type BadgeSpec } from "./DataSourceBadge";

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
    <section className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <span className="font-label-sm uppercase tracking-wider text-label-sm text-on-surface-variant">
          {label}
        </span>
        {badge ? <DataSourceBadge badge={badge} /> : null}
      </div>
      <div className="my-1">
        <p
          className={
            valueSize === "big"
              ? "font-headline-lg text-[40px] font-extrabold leading-tight tracking-tight tabular-nums text-on-surface"
              : "font-headline-sm text-headline-sm font-bold tabular-nums text-on-surface"
          }
        >
          {value}
        </p>
        {sub ? (
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{sub}</p>
        ) : null}
      </div>
      {oldRate ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-2.5">
          <span className="font-label-sm uppercase tracking-wider text-label-sm text-on-surface-variant">
            Rate age
          </span>
          <OldRateTag />
        </div>
      ) : null}
    </section>
  );
}
