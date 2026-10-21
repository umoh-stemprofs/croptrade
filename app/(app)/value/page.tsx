// Work out value wizard (04-croptrade.md screens 3): step 1 crop + kg, step 2
// currency + export cost. Server-validated at every step; a currency without a rate
// is sent to the Rates page with one plain sentence instead of crashing.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { listStock } from "@/lib/inventory";
import { prismaStockDb } from "@/lib/server/stockDb";
import { prisma } from "@/lib/db";
import { effectiveRates } from "@/lib/fx/effective";
import { FX_QUOTES } from "@/lib/config";
import { formatRate } from "@/lib/format";
import { firstWizardMessage, stockCrops, wizardStep1Schema } from "@/lib/value";
import { DataSourceBadge, OldRateTag } from "@/components/DataSourceBadge";
import { rateRowBadge } from "@/components/dashboard/Cards";
import { StepBar } from "@/components/ui/StepBar";
import { ErrorLine } from "@/components/ui/Notice";
import { Field, primaryButtonClass, secondaryButtonClass } from "@/components/ui/Field";
import { StepOneForm } from "@/components/value/StepOneForm";

export const dynamic = "force-dynamic";

type SearchParams = {
  step?: string;
  crop?: string;
  qtyKg?: string;
};

export default async function ValuePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { farm, items } = await listStock(prismaStockDb, user.id);
  const crops = stockCrops(items);
  const step = searchParams.step === "2" ? 2 : 1;

  if (step === 1) {
    return (
      <>
        <header>
          <h1 className="font-display text-display-lg-mobile sm:text-display-lg">Work out value</h1>
          <p className="mt-1 text-base leading-6 text-muted">
            Turn stock into the money it could earn abroad.
          </p>
          <StepBar step={1} total={2} />
        </header>

        {crops.length === 0 ? (
          <section className="mt-6 max-w-[560px] rounded-card border border-border bg-surface p-6 shadow-card">
            <h2 className="text-headline-sm">No stock to value yet</h2>
            <p className="mt-2 text-base leading-6 text-muted">
              Add a crop on the Stock page first, then come back here.
            </p>
            <Link
              href="/stock"
              className={`mt-4 inline-flex ${primaryButtonClass} sm:w-auto sm:px-6`}
            >
              Add stock
            </Link>
          </section>
        ) : (
          <StepOneForm crops={crops} />
        )}
      </>
    );
  }

  // Step 2 — the step-1 answers must still be valid.
  const parsed = wizardStep1Schema.safeParse({
    crop: searchParams.crop ?? "",
    qtyKg: searchParams.qtyKg ?? "",
  });
  if (!parsed.success) {
    return (
      <>
        <header>
          <h1 className="font-display text-display-lg-mobile sm:text-display-lg">Work out value</h1>
          <StepBar step={1} total={2} />
        </header>
        <ErrorLine message={firstWizardMessage(parsed.error)} />
        <Link href="/value" className="mt-4 inline-block text-base font-semibold text-accent underline underline-offset-2">
          Start again
        </Link>
      </>
    );
  }
  const { crop, qtyKg } = parsed.data;
  const stockRow = crops.find((item) => item.crop === crop);
  const label = stockRow?.label ?? crop;

  const settings = farm
    ? await prisma.settings.findUnique({ where: { farmId: farm.id } })
    : null;
  const rates = farm
    ? await effectiveRates(farm.id)
    : { ok: false as const, error: "No farm found for this account." };
  const rateRows = rates.ok ? rates.rates : [];
  const firstAvailable = FX_QUOTES.find((quote) => rateRows.some((row) => row.quote === quote));

  return (
    <>
      <header>
        <h1 className="font-display text-display-lg-mobile sm:text-display-lg">Work out value</h1>
        <p className="mt-1 text-base leading-6 text-muted">
          {label} · {qtyKg} kg from your stock.
        </p>
        <StepBar step={2} total={2} />
      </header>

      {!rates.ok ? <ErrorLine message={rates.error} /> : null}

      <form method="get" action="/value/result" className="mt-6 max-w-[560px] space-y-6">
        <input type="hidden" name="crop" value={crop} />
        <input type="hidden" name="qtyKg" value={qtyKg} />

        <fieldset>
          <legend className="text-sm font-medium leading-5 text-muted">Choose a currency</legend>
          <div className="mt-2 space-y-2">
            {FX_QUOTES.map((quote) => {
              const row = rateRows.find((item) => item.quote === quote);
              if (!row) {
                return (
                  <div
                    key={quote}
                    className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-input border border-border bg-surface px-3 py-2"
                  >
                    <span className="text-base font-medium text-text">{quote}</span>
                    <span className="text-sm leading-5 text-muted">
                      No rate saved for {quote}.{" "}
                      <Link
                        href={`/rates/change?quote=${quote}`}
                        className="font-semibold text-accent underline underline-offset-2"
                      >
                        Set it on the Rates page.
                      </Link>
                    </span>
                  </div>
                );
              }
              return (
                <label
                  key={quote}
                  className="flex min-h-12 cursor-pointer flex-wrap items-center justify-between gap-3 rounded-input border border-border bg-surface px-3 py-2 hover:bg-bg focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="quote"
                      value={quote}
                      required
                      defaultChecked={quote === firstAvailable}
                      className="h-5 w-5 accent-accent"
                    />
                    <span>
                      <span className="block text-base font-semibold text-text">{quote}</span>
                      <span className="block text-sm tabular-nums text-muted">
                        1 {quote} = {formatRate(row.localPerForeign)}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <DataSourceBadge badge={rateRowBadge(row)} />
                    {row.old ? <OldRateTag /> : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field
          label="Export cost %"
          name="exportCostPct"
          type="number"
          min={0}
          max={100}
          step="any"
          required
          inputMode="decimal"
          defaultValue={settings?.exportCostPct ?? 0}
          helper="Costs taken off the export value, from 0 to 100. Starts from your settings."
        />

        {rateRows.length > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="submit" className={`${primaryButtonClass} sm:w-auto sm:px-6`}>
              See value
            </button>
            <Link href="/value" className={`${secondaryButtonClass} sm:w-auto sm:px-6`}>
              Back
            </Link>
          </div>
        ) : (
          <Link href="/rates" className={`${secondaryButtonClass} sm:w-auto sm:px-6`}>
            Go to Rates
          </Link>
        )}
      </form>
    </>
  );
}
