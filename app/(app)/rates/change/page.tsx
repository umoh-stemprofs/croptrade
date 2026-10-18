// Change rate (04-croptrade.md screen 7): "1 [currency] = ? NGN", above 0, Save.
// The override is stored in this farm's ManualRate row only; "Use live rate again"
// deletes it so the shared live/saved rate applies once more.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { prisma } from "@/lib/db";
import { prismaManualStore } from "@/lib/fx/prismaManualStore";
import { effectiveRates } from "@/lib/fx/effective";
import { FX_QUOTES } from "@/lib/config";
import { formatDateHuman, formatRate } from "@/lib/format";
import { clearManualRateAction, setManualRateAction } from "@/lib/actions/rates";
import { DataSourceBadge, OldRateTag } from "@/components/DataSourceBadge";
import { rateRowBadge } from "@/components/dashboard/Cards";
import { ErrorLine } from "@/components/ui/Notice";
import {
  Field,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/Field";

export const dynamic = "force-dynamic";

type SearchParams = { quote?: string; error?: string };

export default async function ChangeRatePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const raw = searchParams.quote ?? "USD";
  const quote = FX_QUOTES.includes(raw as (typeof FX_QUOTES)[number]) ? raw : "USD";

  const farm = await prisma.farm.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  let manual: { localPerForeign: number; setOn: string } | null = null;
  if (farm) {
    try {
      const rows = await prismaManualStore.forFarm(farm.id);
      const row = rows.find((item) => item.quote === quote);
      manual = row ? { localPerForeign: row.localPerForeign, setOn: row.setOn } : null;
    } catch {
      manual = null;
    }
  }

  const rates = farm
    ? await effectiveRates(farm.id)
    : { ok: false as const, error: "No farm found for this account." };
  const effective = rates.ok ? rates.rates.find((row) => row.quote === quote) : undefined;

  return (
    <>
      <header>
        <Link
          href="/rates"
          className="text-base font-semibold text-accent underline underline-offset-2"
        >
          Back to Rates
        </Link>
        <h1 className="mt-2 text-[32px] font-bold leading-10">Change the {quote} rate</h1>
        <p className="mt-1 max-w-[70ch] text-base leading-6 text-muted">
          This rate is used only for your farm.
        </p>
      </header>

      {searchParams.error ? <ErrorLine message={searchParams.error} /> : null}
      {!rates.ok ? <ErrorLine message={rates.error} /> : null}

      {effective ? (
        <section className="mt-6 rounded-card border border-border bg-surface p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-base font-medium leading-6 text-muted">
              Current rate for 1 {quote}
            </h2>
            <DataSourceBadge badge={rateRowBadge(effective)} />
          </div>
          <p className="mt-3 text-[32px] font-bold leading-10 tabular-nums">
            {formatRate(effective.localPerForeign)}
          </p>
          <p className="mt-2 text-sm leading-5 text-muted">
            {manual ? "Set by you" : "From the shared rate"} · {formatDateHuman(effective.date)}
          </p>
          {effective.old ? (
            <p className="mt-2">
              <OldRateTag />
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 max-w-[560px] rounded-card border border-border bg-surface p-6 shadow-card">
        <form action={setManualRateAction} className="space-y-4">
          <input type="hidden" name="quote" value={quote} />
          <Field
            label={`1 ${quote} = ? NGN`}
            name="localPerForeign"
            type="number"
            min="0.01"
            step="any"
            required
            inputMode="decimal"
            defaultValue={manual?.localPerForeign ?? ""}
            placeholder={effective ? String(effective.localPerForeign) : "e.g. 1500"}
            helper="Above 0. Old rates still calculate, but get the Old rate tag."
          />
          <button type="submit" className={`${primaryButtonClass} sm:w-auto sm:px-6`}>
            Save rate
          </button>
        </form>

        {manual ? (
          <form action={clearManualRateAction} className="mt-4 border-t border-border pt-4">
            <input type="hidden" name="quote" value={quote} />
            <button type="submit" className={`${secondaryButtonClass} sm:w-auto sm:px-6`}>
              Use live rate again
            </button>
            <p className="mt-2 text-sm leading-5 text-muted">
              Removes your manual rate ({formatRate(manual.localPerForeign)}, set{" "}
              {formatDateHuman(manual.setOn)}) and uses the shared live or saved rate.
            </p>
          </form>
        ) : (
          <p className="mt-4 text-sm leading-5 text-muted">
            You are using the shared live or saved rate. Saving a manual rate replaces it
            for your farm only.
          </p>
        )}
      </section>
    </>
  );
}
