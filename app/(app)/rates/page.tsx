// Rates (04-croptrade.md screen 6): one card per currency with rate, date, source
// badge, Old rate tag and a Change button, plus the 30-day line chart with a
// currency switch (the same numbers are in the card's "View as table"). Manual
// rates are private to this farm; live rates stay shared. The
// Exchange Rate API credit stays visible.

import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { prisma } from "@/lib/db";
import { effectiveRates } from "@/lib/fx/effective";
import { FX_ATTRIBUTION } from "@/lib/fx/rates";
import { formatDateHuman, formatRate } from "@/lib/format";
import { DataSourceBadge, OldRateTag } from "@/components/DataSourceBadge";
import { rateRowBadge } from "@/components/dashboard/Cards";
import { ErrorLine, SuccessLine } from "@/components/ui/Notice";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { RatesChartSection } from "@/components/charts/sections";

export const dynamic = "force-dynamic";

type SearchParams = { saved?: string; cleared?: string; missing?: string; error?: string };

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

  const missing = searchParams.missing;

  return (
    <>
      <header>
        <h1 className="font-display text-display-lg-mobile sm:text-display-lg">Rates</h1>
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

      <div className="mt-6">
        <Suspense fallback={<ChartSkeleton />}>
          <RatesChartSection farmId={farm?.id ?? null} />
        </Suspense>
      </div>

      {rates.ok ? (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {rates.rates.map((row) => (
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

              <Link
                href={`/rates/change?quote=${row.quote}`}
                className="mt-4 inline-flex h-12 items-center rounded-input border border-border bg-surface px-4 text-base font-semibold text-text hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Change
              </Link>
            </section>
          ))}
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
