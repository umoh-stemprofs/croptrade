// My Crop Stock — the Google Stitch my_crop_stock page. The server loads the
// farm's stock and today's WFP prices; StockLedger renders the prototype's
// telemetry bar, filters, crop cards, audit ledger and dispatch bar with those
// real figures (no Simulated/Live badges — removed per request; a missing
// price shows an honest "no live price" instead of a number).

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import {
  cropLabel,
  emvKobo,
  listStock,
  totalStockValueKobo,
} from "@/lib/inventory";
import { prismaStockDb } from "@/lib/server/stockDb";
import { getMarketProvider } from "@/lib/market/provider";
import { formatDateHuman, formatNairaFromKobo } from "@/lib/format";
import { ErrorLine } from "@/components/ui/Notice";
import { StockLedger, type StockRowView } from "@/components/stock/StockLedger";

export const dynamic = "force-dynamic";

export default async function StockPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { farm, items } = await listStock(prismaStockDb, user.id);
  const prices = await getMarketProvider()
    .latestPrices()
    .catch(() => []);
  const kgPrices = new Map(prices.filter((p) => p.unit === "KG").map((p) => [p.crop, p.priceKobo]));
  const priceDate = prices[0]?.date ?? null;

  const rows: StockRowView[] = items.map((item) => {
    const priceKobo = kgPrices.get(item.crop) ?? null;
    return {
      id: item.id,
      crop: item.crop,
      qtyKg: item.qtyKg,
      note: item.note,
      priceKobo,
      valueKobo: priceKobo !== null ? emvKobo(item.qtyKg, priceKobo) : null,
    };
  });
  const totalKobo = totalStockValueKobo(
    rows.map((r) => ({ qtyKg: r.qtyKg, priceKobo: r.priceKobo ?? 0 }))
  );

  return (
    <>
      {/* Header area — prototype copy structure */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-xl">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs mb-1">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary font-bold">
              Physical Inventory Dispatch
            </span>
            <span className="text-outline-variant">•</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {priceDate ? `Valued at today’s WFP survey · ${formatDateHuman(priceDate)}` : "Awaiting today’s WFP survey"}
            </span>
          </div>
          <h1 className="font-display text-display-lg-mobile sm:text-display-lg text-on-surface font-extrabold tracking-tight">
            My Crop Stock
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
            Set exact harvest weights, filter the ledger, then commit your adjustments.
          </p>
        </div>

        <div className="flex items-center gap-space-md bg-surface-container-lowest p-space-sm px-space-md rounded-xl shadow-sm border border-outline-variant self-start md:self-auto">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-semibold">
              Active Batches
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold tabular-nums">
              {rows.length}
            </span>
          </div>
          <div className="h-8 w-px bg-surface-container-high"></div>
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-semibold">
              Estimated Yield Value
            </span>
            <span className="font-headline-sm text-headline-sm text-primary font-bold tabular-nums">
              {rows.length === 0 ? "—" : formatNairaFromKobo(totalKobo)}
            </span>
          </div>
        </div>
      </div>

      {searchParams.error ? <div className="mb-space-lg"><ErrorLine message={searchParams.error} /></div> : null}

      <StockLedger rows={rows} hasFarm={farm !== null} priceDate={priceDate} />
    </>
  );
}
