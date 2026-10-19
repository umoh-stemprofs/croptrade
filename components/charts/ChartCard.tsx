"use client";

// Chart card shell (design.md §2 + §4): title, data-source badge, the chart itself,
// a "View as table" link that shows exactly the same numbers, and an empty state
// with an icon, one sentence and one button. Every chart on the site sits in this
// card, so the patterns never drift apart.

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { DataSourceBadge, type BadgeSpec } from "@/components/DataSourceBadge";
import { secondaryButtonClass } from "@/components/ui/Field";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export interface ChartTableSpec {
  columns: string[];
  rows: (string | number)[][];
  /** One short sentence under the table. */
  note?: string;
}

export interface ChartEmptySpec {
  /** One plain sentence. */
  message: string;
  action: { href: string; label: string };
}

function ChartIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 20V6" />
      <path d="M4 20h16" />
      <rect x="7" y="12" width="3" height="5" rx="1" />
      <rect x="12" y="8" width="3" height="9" rx="1" />
      <rect x="17" y="4" width="3" height="13" rx="1" />
    </svg>
  );
}

function ChartTable({ table }: { table: ChartTableSpec }) {
  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              {table.columns.map((column) => (
                <th key={column} scope="col" className="whitespace-nowrap px-2 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`whitespace-nowrap px-2 py-2 ${
                      cellIndex === 0 ? "" : "tabular-nums"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note ? <p className="mt-2 text-sm leading-5 text-muted">{table.note}</p> : null}
    </div>
  );
}

export function ChartCard({
  title,
  badge,
  table,
  empty,
  note,
  controls,
  children,
}: {
  title: string;
  /** Data-source badge for the numbers in this chart. */
  badge?: BadgeSpec;
  table: ChartTableSpec;
  /** When set, the chart is replaced by the empty state. */
  empty?: ChartEmptySpec;
  /** One sentence under the chart (units, gaps, grouping). */
  note?: string;
  /** Optional switcher (currency, crop, range) shown above the chart. */
  controls?: ReactNode;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-medium leading-6 text-muted">{title}</h2>
        {badge ? <DataSourceBadge badge={badge} /> : null}
      </div>

      {controls ? <div className="mt-3">{controls}</div> : null}

      {empty ? (
        <div className="mt-4 flex flex-col items-start gap-3">
          <ChartIcon className="h-8 w-8 text-muted" />
          <p className="text-base leading-6 text-muted">{empty.message}</p>
          <Link
            href={empty.action.href}
            className={`${secondaryButtonClass} w-auto px-4 ${focusRing}`}
          >
            {empty.action.label}
          </Link>
        </div>
      ) : showTable ? (
        <ChartTable table={table} />
      ) : (
        <div className="mt-4">
          <div
            role="img"
            aria-label={`${title} chart. Use “View as table” for the same numbers.`}
          >
            {children}
          </div>
          {note ? <p className="mt-2 text-sm leading-5 text-muted">{note}</p> : null}
        </div>
      )}

      {empty ? null : (
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-expanded={showTable}
          className={`mt-3 inline-flex min-h-12 items-center text-sm font-semibold text-accent underline underline-offset-2 ${focusRing}`}
        >
          {showTable ? "View as chart" : "View as table"}
        </button>
      )}
    </section>
  );
}
