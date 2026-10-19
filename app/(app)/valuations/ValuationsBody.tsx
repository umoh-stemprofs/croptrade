// Saved valuations body (04-croptrade.md screen 5): this farm only, newest first.
// Owns its own data load so the page can stream a skeleton while the rows and the
// chart arrive. The delete action re-checks ownership on the server.

import Link from "next/link";
import { prismaValuationDb } from "@/lib/server/valuationDb";
import { listValuations, valuationTotals } from "@/lib/valuations";
import { cropLabel } from "@/lib/inventory";
import { formatDateShort, formatForeign, formatRate } from "@/lib/format";
import { primaryButtonClass } from "@/components/ui/Field";
import { DeleteValuationButton } from "@/components/value/DeleteValuationButton";
import { ValuationsChartSection } from "@/components/charts/sections";

function EmptyIcon({ className }: { className: string }) {
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
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15l4-5 3 3 4-6" />
    </svg>
  );
}

export async function ValuationsBody({ userId }: { userId: string }) {
  const { rows } = await listValuations(prismaValuationDb, userId);
  const totals = valuationTotals(rows);

  if (rows.length === 0) {
    return (
      <section className="mt-6 rounded-card border border-border bg-surface p-6 shadow-card">
        <EmptyIcon className="h-8 w-8 text-muted" />
        <h2 className="mt-3 text-[20px] font-semibold leading-7">No saved valuations yet</h2>
        <p className="mt-2 text-base leading-6 text-muted">
          Work out what a crop could earn abroad, then save the result here.
        </p>
        <Link href="/value" className={`mt-4 inline-flex ${primaryButtonClass} sm:w-auto sm:px-6`}>
          Work out value
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className="mt-6 rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="text-base font-medium leading-6 text-muted">Totals saved</h2>
        <ul className="mt-3 space-y-1">
          {totals.map((total) => (
            <li key={total.quote} className="flex flex-wrap justify-between gap-2 text-base">
              <span className="text-muted">Net in {total.quote}</span>
              <span className="font-semibold tabular-nums">
                {formatForeign(total.total, total.quote)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm leading-5 text-muted">Currencies are never added together.</p>
      </section>

      <div className="mt-6">
        <ValuationsChartSection rows={rows} />
      </div>

      {/* Desktop table */}
      <div className="mt-6 hidden overflow-hidden rounded-card border border-border bg-surface shadow-card md:block">
        <table className="w-full text-left">
          <thead className="border-b border-border text-sm text-muted">
            <tr>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Crop</th>
              <th className="px-6 py-3 font-medium">Kg</th>
              <th className="px-6 py-3 font-medium">Currency</th>
              <th className="px-6 py-3 font-medium">Net value</th>
              <th className="px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-6 py-4 text-base tabular-nums">{formatDateShort(row.date)}</td>
                <td className="px-6 py-4 text-base font-medium">{cropLabel(row.crop)}</td>
                <td className="px-6 py-4 text-base tabular-nums">{row.qtyKg} kg</td>
                <td className="px-6 py-4 text-base">{row.quote}</td>
                <td className="px-6 py-4 text-base font-semibold tabular-nums">
                  {formatForeign(row.netForeign, row.quote)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end">
                    <DeleteValuationButton
                      id={row.id}
                      label={`${cropLabel(row.crop)} · ${row.qtyKg} kg · ${formatForeign(
                        row.netForeign,
                        row.quote
                      )}.`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <ul className="mt-6 space-y-4 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-card border border-border bg-surface p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-base font-semibold">{cropLabel(row.crop)}</p>
              <p className="text-sm tabular-nums text-muted">{formatDateShort(row.date)}</p>
            </div>
            <p className="mt-3 text-[24px] font-bold leading-8 tabular-nums">
              {formatForeign(row.netForeign, row.quote)}
            </p>
            <p className="mt-1 text-sm text-muted">
              {row.qtyKg} kg · 1 {row.quote} = {formatRate(row.rate)}
            </p>
            <div className="mt-4">
              <DeleteValuationButton
                id={row.id}
                label={`${cropLabel(row.crop)} · ${row.qtyKg} kg · ${formatForeign(
                  row.netForeign,
                  row.quote
                )}.`}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
