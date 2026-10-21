// Saved valuations (04-croptrade.md screen 5): page header and notices first, then
// the body (totals, chart, list) streams in under a skeleton.

import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { ErrorLine, SuccessLine } from "@/components/ui/Notice";
import { primaryButtonClass } from "@/components/ui/Field";
import { ListSkeleton } from "@/components/charts/ChartSkeleton";
import { ValuationsBody } from "./ValuationsBody";

export const dynamic = "force-dynamic";

type SearchParams = { saved?: string; deleted?: string; error?: string };

export default async function ValuationsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-display-lg-mobile sm:text-display-lg">Valuations</h1>
          <p className="mt-1 text-base leading-6 text-muted">
            Export values you saved for this farm, newest first.
          </p>
        </div>
        <Link href="/value" className={`${primaryButtonClass} sm:w-auto sm:px-6`}>
          Work out value
        </Link>
      </header>

      {searchParams.error ? <ErrorLine message={searchParams.error} /> : null}
      {searchParams.saved ? <SuccessLine message="Valuation saved." /> : null}
      {searchParams.deleted ? <SuccessLine message="Valuation deleted." /> : null}

      <Suspense fallback={<ListSkeleton />}>
        <ValuationsBody userId={user.id} />
      </Suspense>
    </>
  );
}
