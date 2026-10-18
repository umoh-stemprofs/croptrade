// Rates (04-croptrade.md screen 6): one card per currency with rate, date, source
// badge, Old rate tag and a Change button. The last 30 days are a simple table for
// now (the chart arrives in step 5). Manual rates are private to this farm; live and
// simulated rates stay shared. The Exchange Rate API credit stays visible.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { prisma } from "@/lib/db";
import { effectiveRates } from "@/lib/fx/effective";
import { fxHistory, type FxHistoryRow } from "@/lib/fx/history";
import { FX_ATTRIBUTION } from "@/lib/fx/rates";
import { formatDateHuman, formatDateShort, formatRate } from "@/lib/format";
import { DataSourceBadge, OldRateTag } from "@/components/DataSourceBadge";
import { rateRowBadge } from "@/components/dashboard/Cards";
import { ErrorLine, SuccessLine } from "@/components/ui/Notice";

export const dynamic = "force-dynamic";

type SearchParams = { saved?: string; cleared?: string; missing?: string; error?: string };

const sourceWord: Record<string, string> = {
  LIVE: "Live",
  SIMULATED: "Simulated",
  MANUAL: "Manual",
};

export default async function RatesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const farm = await prisma.farm.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const rates = farm
    ? await effectiveRates(farm.id)
    : { ok: false as const, error: "No farm found for this account." };

  const history: Record<string, FxHistoryRow[]> = {};
  if (rates.ok) {
    await Promise.all(
      rates.rates.map(async (row) => {
        history[row.quote] = await fxHistory(row.quote).catch(() => []);
      })
    );
  }

  const missing = searchParams.missing;

  return (
    <>
      <header>
        <h1 className="text-[32px] font-bold leading-10">Rates</h1>
        <p className="mt-1 max-w-[70ch] text-base leading-6 text-muted">
          Rate meaning: 1 foreign currency = X naira. A manual rate is yours alone and
          replaces the shared rate for your farm.
        </p>
      </header>

      {missing ? (
        <ErrorLine message={`No rate saved for ${missing} yet. Set one below.`} />
      ) : null}
      {searchParams.error ? <ErrorLine message={searchParams.error} /> : null}
      {searchParams.saved ? <SuccessLine message="Manual rate saved." /> : null}
      {searchParams.cleared ? <SuccessLine message="Using the live rate again." /> : null}
      {!rates.ok ? <ErrorLine message={rates.error} /> : null}

      {rates.ok ? (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {rates.rates.map((row) => {
            const rows = history[row.quote] ?? [];
            return (
              <section
                key={row.quote}
                aria-labelledby={`rate-${row.quote}`}
                className="rounded-card border border-border bg-surface p-6 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 id={`rate-${row.quote}`} className="text-base font-medium leading-6 text-muted">
                    1 {row.quote}
                  </h2>
                  <DataSourceBadge badge={rateRowBadge(row)} />
                </div>
                <p className="mt-3 text-[32px] font-bold leading-10 tabular-nums">
                  {formatRate(row.localPerForeign)}
                </p>
                <p className="mt-2 text-sm leading-5 text-muted">
                  Rate of {formatDateHuman(row.date)}
                </p>
                {row.old ? (
                  <p className="mt-2">
                    <OldRateTag />
                  </p>
                ) : null}

                <details className="mt-4">
                  <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-accent">
                    Last 30 days
                  </summary>
                  {rows.length === 0 ? (
                    <p className="mt-2 text-sm leading-5 text-muted">No saved history yet.</p>
                  ) : (
                    <div className="mt-2 overflow-hidden rounded-input border border-border">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-border text-muted">
                          <tr>
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium">Rate</th>
                            <th className="px-3 py-2 font-medium">Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {rows.map((entry) => (
                            <tr key={entry.date}>
                              <td className="px-3 py-2 tabular-nums">{formatDateShort(entry.date)}</td>
                              <td className="px-3 py-2 tabular-nums">
                                {formatRate(entry.localPerForeign)}
                              </td>
                              <td className="px-3 py-2">{sourceWord[entry.source] ?? entry.source}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </details>

                <Link
                  href={`/rates/change?quote=${row.quote}`}
                  className="mt-4 inline-flex h-12 items-center rounded-input border border-border bg-surface px-4 text-base font-semibold text-text hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Change
                </Link>
              </section>
            );
          })}
        </div>
      ) : null}

      <p className="mt-8 text-sm leading-5 text-muted">
        Rates meaning “1 foreign = X local”.{" "}
        <a
          href={FX_ATTRIBUTION.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2"
        >
          {FX_ATTRIBUTION.label}
        </a>
      </p>
    </>
  );
}
