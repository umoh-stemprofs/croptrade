// Stock (S-INV): total value card on top, table on desktop and cards on phone,
// add / edit / delete with a confirm dialog. Every action is checked on the server.
// Estimated market value = kg × latest price per kg, in integer kobo, shown as naira.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import {
  KG_CROPS,
  cropLabel,
  emvKobo,
  listStock,
  totalStockValueKobo,
} from "@/lib/inventory";
import { prismaStockDb } from "@/lib/server/stockDb";
import { getMarketProvider } from "@/lib/market/provider";
import { addStockAction } from "@/lib/actions/stock";
import { formatDateHuman, formatNairaFromKobo } from "@/lib/format";
import { DataSourceBadge, type BadgeSpec } from "@/components/DataSourceBadge";
import { StatCard } from "@/components/StatCard";
import { ErrorLine } from "@/components/ui/Notice";
import { Field, inputClass, primaryButtonClass } from "@/components/ui/Field";
import { EditStockButton } from "@/components/stock/EditStockButton";
import { DeleteStockButton } from "@/components/stock/DeleteStockButton";

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
  const priceBadge: BadgeSpec =
    prices[0]?.source === "LIVE" ? { kind: "live" } : { kind: "simulated" };

  const rows = items.map((item) => {
    const priceKobo = kgPrices.get(item.crop) ?? null;
    return {
      ...item,
      label: cropLabel(item.crop),
      priceKobo,
      valueKobo: priceKobo !== null ? emvKobo(item.qtyKg, priceKobo) : null,
    };
  });
  const totalKobo = totalStockValueKobo(
    rows.map((r) => ({ qtyKg: r.qtyKg, priceKobo: r.priceKobo ?? 0 }))
  );

  return (
    <>
      <header className="mb-6">
        <h1 className="text-[32px] font-bold leading-10">Stock</h1>
        <p className="mt-1 text-base leading-6 text-muted">
          What you have in store, valued at today’s price per kg.
        </p>
      </header>

      <StatCard
        label="Total stock value"
        value={formatNairaFromKobo(totalKobo)}
        sub={
          rows.length === 0
            ? "No stock yet. Add your first crop below."
            : priceDate
              ? `As of ${formatDateHuman(priceDate)} · ${rows.length} item${rows.length === 1 ? "" : "s"}`
              : undefined
        }
        badge={rows.length > 0 ? priceBadge : undefined}
      />

      {searchParams.error ? <div className="mt-6"><ErrorLine message={searchParams.error} /></div> : null}

      {/* Add stock */}
      <section className="mt-6 rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="text-[20px] font-semibold leading-7">Add stock</h2>
        {farm ? (
          <form action={addStockAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="crop" className="block text-sm font-medium leading-5 text-muted">
                Crop
              </label>
              <select id="crop" name="crop" required className={inputClass}>
                {KG_CROPS.map((crop) => (
                  <option key={crop} value={crop}>
                    {cropLabel(crop)}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Kg"
              name="qtyKg"
              type="number"
              min="0.1"
              step="any"
              required
              inputMode="decimal"
              helper="More than 0 kg."
            />
            <Field label="Note" name="note" maxLength={200} placeholder="Optional" />
            <div className="sm:col-span-3">
              <button type="submit" className={`${primaryButtonClass} sm:w-auto sm:px-6`}>
                Add stock
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-base text-muted">No farm found for this account.</p>
        )}
      </section>

      {/* Desktop table */}
      {rows.length > 0 ? (
        <div className="mt-6 hidden overflow-hidden rounded-card border border-border bg-surface shadow-card md:block">
          <table className="w-full text-left">
            <thead className="border-b border-border text-sm text-muted">
              <tr>
                <th className="px-6 py-3 font-medium">Crop</th>
                <th className="px-6 py-3 font-medium">Kg</th>
                <th className="px-6 py-3 font-medium">Today’s price per kg</th>
                <th className="px-6 py-3 font-medium">Estimated market value</th>
                <th className="px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-6 py-4 text-base font-medium">{row.label}</td>
                  <td className="px-6 py-4 text-base tabular-nums">{row.qtyKg} kg</td>
                  <td className="px-6 py-4">
                    <span className="flex flex-wrap items-center gap-2 text-base tabular-nums">
                      {row.priceKobo !== null ? formatNairaFromKobo(row.priceKobo) : "—"}
                      <DataSourceBadge badge={priceBadge} />
                    </span>
                  </td>
                  <td className="px-6 py-4 text-base font-semibold tabular-nums">
                    {row.valueKobo !== null ? formatNairaFromKobo(row.valueKobo) : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <EditStockButton id={row.id} qtyKg={row.qtyKg} note={row.note} />
                      <DeleteStockButton id={row.id} label={row.label} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Phone cards */}
      {rows.length > 0 ? (
        <ul className="mt-6 space-y-4 md:hidden">
          {rows.map((row) => (
            <li key={row.id} className="rounded-card border border-border bg-surface p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-base font-semibold">{row.label}</p>
                <DataSourceBadge badge={priceBadge} />
              </div>
              <dl className="mt-3 space-y-1 text-base">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Quantity</dt>
                  <dd className="tabular-nums">{row.qtyKg} kg</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Price per kg</dt>
                  <dd className="tabular-nums">
                    {row.priceKobo !== null ? formatNairaFromKobo(row.priceKobo) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 font-semibold">
                  <dt>Estimated value</dt>
                  <dd className="tabular-nums">
                    {row.valueKobo !== null ? formatNairaFromKobo(row.valueKobo) : "—"}
                  </dd>
                </div>
              </dl>
              {row.note ? <p className="mt-2 text-sm text-muted">{row.note}</p> : null}
              <div className="mt-4 flex flex-col gap-3">
                <EditStockButton id={row.id} qtyKg={row.qtyKg} note={row.note} />
                <DeleteStockButton id={row.id} label={row.label} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
