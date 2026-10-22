// Result (04-croptrade.md screen 4): huge net export value, the gross, the naira
// total, the rate with date + source badge + Old rate tag, best-rate advice,
// and Save / Again. The same numbers are recomputed on the server before saving.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { prismaStockDb } from "@/lib/server/stockDb";
import { getMarketProvider } from "@/lib/market/provider";
import { effectiveRates } from "@/lib/fx/effective";
import { previousRates } from "@/lib/fx/history";
import { bestRateAdvice, exportValue } from "@/lib/export";
import { todayIso } from "@/lib/time";
import { formatDateHuman, formatForeign, formatNairaFromKobo, formatRate } from "@/lib/format";
import { cropLabel } from "@/lib/inventory";
import { firstWizardMessage, wizardResultSchema } from "@/lib/value";
import { saveValuationAction } from "@/lib/actions/valuations";
import { DataSourceBadge, OldRateTag } from "@/components/DataSourceBadge";
import { rateRowBadge } from "@/components/dashboard/Cards";
import { ErrorLine } from "@/components/ui/Notice";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/Field";

export const dynamic = "force-dynamic";

type SearchParams = {
  crop?: string;
  qtyKg?: string;
  quote?: string;
  exportCostPct?: string;
};

function AgainLink() {
  return (
    <Link href="/value" className={`${secondaryButtonClass} sm:w-auto sm:px-6`}>
      Again
    </Link>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <>
      <header>
        <h1 className="font-display text-display-lg-mobile sm:text-display-lg text-on-surface tracking-tight">Your export value</h1>
      </header>
      <ErrorLine message={message} />
      <div className="mt-4">
        <AgainLink />
      </div>
    </>
  );
}

export default async function ValueResultPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const parsed = wizardResultSchema.safeParse({
    crop: searchParams.crop ?? "",
    qtyKg: searchParams.qtyKg ?? "",
    quote: searchParams.quote ?? "",
    exportCostPct: searchParams.exportCostPct ?? "",
  });
  if (!parsed.success) return <Problem message={firstWizardMessage(parsed.error)} />;
  const { crop, qtyKg, quote, exportCostPct } = parsed.data;

  const farm = await prismaStockDb.firstFarmForUser(user.id);
  const prices = await getMarketProvider()
    .latestPrices()
    .catch(() => []);
  const price = prices.find((row) => row.crop === crop && row.unit === "KG");
  const rates = farm
    ? await effectiveRates(farm.id)
    : { ok: false as const, error: "No farm found for this account." };
  const rate = rates.ok ? rates.rates.find((row) => row.quote === quote) : undefined;

  if (!rate) redirect(`/rates?missing=${quote}`);
  if (!price) return <Problem message="No price available for that crop right now. Try again later." />;

  const today = todayIso();
  const result = exportValue({
    quote,
    qtyKg,
    localPricePerKgKobo: price.priceKobo,
    localPerForeign: rate.localPerForeign,
    rateDate: rate.date,
    exportCostPct,
    today,
  });
  if (!result.ok) {
    if (result.kind === "no-rate") redirect(`/rates?missing=${quote}`);
    return <Problem message={result.error} />;
  }

  let history: number[] = [];
  try {
    history = await previousRates(quote, today);
  } catch {
    history = [];
  }
  const advice = bestRateAdvice(rate.localPerForeign, history);

  return (
    <>
      <header>
        <h1 className="font-display text-display-lg-mobile sm:text-display-lg text-on-surface tracking-tight">Your export value</h1>
        <p className="mt-1 text-base leading-6 text-muted">
          {cropLabel(crop)} · {qtyKg} kg · {quote}
        </p>
      </header>

      <section className="mt-6 bg-surface-container-lowest rounded-xl border border-outline-variant p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-medium leading-6 text-muted">Net after export costs</h2>
          <DataSourceBadge badge={rateRowBadge(rate)} />
        </div>
        <p className="mt-3 text-[40px] font-bold leading-[48px] tabular-nums">
          {formatForeign(result.netForeign, quote)}
        </p>
        <p className="mt-2 text-base leading-6 text-muted">
          Gross {formatForeign(result.grossForeign, quote)} · {exportCostPct}% export cost
        </p>
        {rate.old ? (
          <p className="mt-2">
            <OldRateTag />
          </p>
        ) : null}
      </section>

      <section className="mt-4 bg-surface-container-lowest rounded-xl border border-outline-variant p-6 shadow-sm">
        <dl className="space-y-3 text-base">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Naira total</dt>
            <dd className="font-semibold tabular-nums">
              {formatNairaFromKobo(result.totalLocalKobo)}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Rate used</dt>
            <dd className="tabular-nums">
              1 {quote} = {formatRate(rate.localPerForeign)}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Rate date</dt>
            <dd className="tabular-nums">{formatDateHuman(rate.date)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">Price per kg</dt>
            <dd className="tabular-nums">{formatNairaFromKobo(price.priceKobo)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-base leading-6 text-text">{advice}</p>
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action={saveValuationAction} className="sm:w-auto">
          <input type="hidden" name="crop" value={crop} />
          <input type="hidden" name="qtyKg" value={qtyKg} />
          <input type="hidden" name="quote" value={quote} />
          <input type="hidden" name="exportCostPct" value={exportCostPct} />
          <button type="submit" className={`${primaryButtonClass} sm:w-auto sm:px-6`}>
            Save valuation
          </button>
        </form>
        <AgainLink />
      </div>

      <p className="mt-6 text-sm leading-5 text-muted">
        This is an estimate. Decision-support tool. You decide.
      </p>
    </>
  );
}
