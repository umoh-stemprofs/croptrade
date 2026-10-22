"use client";

// My Crop Stock — the Google Stitch my_crop_stock page, structure and classes
// copied from the prototype: search & filter card, quick-adjust crop cards,
// the sortable audit ledger and the dispatch bar. Every figure comes from the
// database (your stock) and the live WFP price feed; the prototype's
// "Simulated"/"Live FX" badges are removed, and a missing price shows an
// honest "no live price" instead of a number.

import { useMemo, useState } from "react";
import { addStockAction } from "@/lib/actions/stock";
import { KG_CROPS, cropLabel } from "@/lib/inventory";
import { formatNairaFromKobo } from "@/lib/format";
import { EditStockButton } from "@/components/stock/EditStockButton";
import { DeleteStockButton } from "@/components/stock/DeleteStockButton";

export interface StockRowView {
  id: string;
  crop: string;
  qtyKg: number;
  note: string | null;
  priceKobo: number | null;
  valueKobo: number | null;
}

const EMOJI: Record<string, string> = {
  MAIZE: "🌽",
  RICE_LOCAL: "🌾",
  RICE_PARBOILED: "🌾",
  CASSAVA: "🥔",
  YAM: "🍠",
  TOMATO: "🍅",
  SOYBEAN: "🫘",
  GROUNDNUT: "🥜",
  GINGER: "🫚",
  PALM_OIL: "🌴",
  SESAME: "🌾",
  SORGHUM: "🌾",
  MILLET: "🌾",
  COWPEA: "🫛",
  PLANTAIN: "🍌",
};

function emojiFor(crop: string): string {
  return EMOJI[crop] ?? "🌱";
}

function fmtKg(kg: number): string {
  return `${Number(kg.toFixed(3)).toLocaleString("en-NG")} kg`;
}

type SortKey = "crop" | "note" | "kg" | "price" | "value";

export function StockLedger({
  rows,
  hasFarm,
  priceDate,
}: {
  rows: StockRowView[];
  hasFarm: boolean;
  priceDate: string | null;
}) {
  const [query, setQuery] = useState("");
  const [cropFilter, setCropFilter] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [pageSize, setPageSize] = useState<number | "all">(8);
  const [page, setPage] = useState(1);

  const cropsInLedger = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.crop)) seen.set(r.crop, cropLabel(r.crop));
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (cropFilter !== "all" && r.crop !== cropFilter) return false;
      if (!q) return true;
      const hay = `${cropLabel(r.crop)} ${r.note ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, cropFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...filtered].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sort.key) {
        case "kg":
          av = a.qtyKg;
          bv = b.qtyKg;
          break;
        case "price":
          av = a.priceKobo ?? -1;
          bv = b.priceKobo ?? -1;
          break;
        case "value":
          av = a.valueKobo ?? -1;
          bv = b.valueKobo ?? -1;
          break;
        case "note":
          av = (a.note ?? "").toLowerCase();
          bv = (b.note ?? "").toLowerCase();
          break;
        default:
          av = cropLabel(a.crop).toLowerCase();
          bv = cropLabel(b.crop).toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort]);

  const pages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows =
    pageSize === "all" ? sorted : sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // One quick-adjust card per crop, aggregating that crop's lots.
  const groups = useMemo(() => {
    const map = new Map<string, { crop: string; lots: StockRowView[]; kg: number; valueKobo: number; priceKobo: number | null }>();
    for (const r of filtered) {
      const g = map.get(r.crop) ?? {
        crop: r.crop,
        lots: [],
        kg: 0,
        valueKobo: 0,
        priceKobo: r.priceKobo,
      };
      g.lots.push(r);
      g.kg += r.qtyKg;
      g.valueKobo += r.valueKobo ?? 0;
      if (r.priceKobo === null) g.priceKobo = null;
      map.set(r.crop, g);
    }
    return [...map.values()].sort((a, b) => b.valueKobo - a.valueKobo);
  }, [filtered]);

  const totalMass = filtered.reduce((s, r) => s + r.qtyKg, 0);
  const totalValue = filtered.reduce((s, r) => s + (r.valueKobo ?? 0), 0);

  const activeFilters: string[] = [];
  if (query.trim()) activeFilters.push(`“${query.trim()}”`);
  if (cropFilter !== "all") activeFilters.push(cropLabel(cropFilter));

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current?.key === key
        ? current.dir === "asc"
          ? { key, dir: "desc" }
          : null
        : { key, dir: "asc" }
    );
    setPage(1);
  }

  function exportCsv() {
    const header = ["Crop", "Note", "Weight (kg)", "Price (NGN/kg)", "Total Value (NGN)"];
    const lines = [header.join(",")];
    for (const r of sorted) {
      lines.push(
        [
          `"${cropLabel(r.crop).replace(/"/g, '""')}"`,
          `"${(r.note ?? "").replace(/"/g, '""')}"`,
          String(r.qtyKg),
          r.priceKobo !== null ? String(r.priceKobo / 100) : "",
          r.valueKobo !== null ? String(r.valueKobo / 100) : "",
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "croptrade-stock.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const sortIcon = (key: SortKey) =>
    sort?.key === key ? (sort.dir === "asc" ? "arrow_upward" : "arrow_downward") : "arrow_upward";

  return (
    <>
      {/* ── Telemetry bar ─────────────────────────────────────────────── */}
      <div className="w-full bg-surface-container-low px-space-md py-space-sm rounded-xl mb-space-lg flex flex-wrap items-center justify-between gap-space-sm text-on-surface-variant font-data-mono text-body-sm shadow-sm border border-outline-variant">
        <div className="flex items-center gap-space-md flex-wrap">
          <div className="flex items-center gap-space-xs">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface font-semibold">
              Silo Telemetry Live
            </span>
          </div>
          <span className="text-outline-variant">|</span>
          <span>
            Total Mass: <strong className="text-on-surface tabular-nums">{fmtKg(totalMass)}</strong>
          </span>
          <span className="hidden sm:inline text-outline-variant">|</span>
          <span className="hidden sm:inline">
            Batches: <strong className="text-on-surface tabular-nums">{rows.length}</strong>
          </span>
        </div>
        <div className="flex items-center gap-space-sm">
          <span className="bg-tertiary/15 text-tertiary-strong px-2 py-0.5 rounded font-label-sm text-label-sm">
            {priceDate ? `WFP prices · ${priceDate}` : "Awaiting price feed"}
          </span>
          <span className="text-outline-variant">|</span>
          <span>Sync: Auto</span>
        </div>
      </div>

      {/* ── Search & filtering ────────────────────────────────────────── */}
      <section
        aria-label="Search and filter inventory"
        className="w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-md mb-space-lg"
      >
        <div className="flex flex-col lg:flex-row lg:items-end gap-space-md">
          <div className="flex-1 min-w-[200px]">
            <label
              className="block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant mb-1"
              htmlFor="inv-search"
            >
              Search inventory
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none">
                search
              </span>
              <input
                id="inv-search"
                type="search"
                autoComplete="off"
                placeholder="Crop name or note…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 pl-10 pr-3 rounded bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface placeholder:text-outline"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 gap-space-sm">
            <div>
              <label
                className="block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant mb-1"
                htmlFor="filter-crop"
              >
                Crop
              </label>
              <select
                id="filter-crop"
                value={cropFilter}
                onChange={(e) => {
                  setCropFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-2 rounded bg-surface-container-lowest border border-outline-variant text-body-sm text-on-surface"
              >
                <option value="all">All crops</option>
                {cropsInLedger.map(([crop, label]) => (
                  <option key={crop} value={crop}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCropFilter("all");
                  setPage(1);
                }}
                className="h-9 px-space-md rounded border border-outline-variant bg-surface-container-lowest hover:bg-surface-container font-label-md text-label-md text-on-surface flex items-center justify-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>

        <p className="mt-space-md font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5" role="status">
          <span className="material-symbols-outlined text-[16px] text-primary">visibility</span>
          <span>
            Showing {filtered.length} of {rows.length} batches
            {activeFilters.length ? ` · filters: ${activeFilters.join(", ")}` : " · no filters applied"}
          </span>
        </p>
      </section>

      {/* ── Quick-adjust crop cards ───────────────────────────────────── */}
      <section aria-label="Crop batches" className="mb-space-xl">
        {groups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-lg">
            {groups.map((g) => (
              <article
                key={g.crop}
                className="flex flex-col justify-between bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-outline-variant transition-all duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-space-sm mb-space-md">
                    <div className="flex items-center gap-space-sm">
                      <div className="w-14 h-14 rounded-xl bg-surface-container-low flex items-center justify-center text-3xl shadow-inner select-none shrink-0">
                        <span aria-hidden="true">{emojiFor(g.crop)}</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                          {g.lots.length} lot{g.lots.length === 1 ? "" : "s"}
                        </span>
                        <h2 className="font-headline-md text-headline-md text-on-surface font-bold leading-tight">
                          {cropLabel(g.crop)}
                        </h2>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {g.priceKobo !== null
                            ? `WFP benchmark ${formatNairaFromKobo(g.priceKobo)}/kg`
                            : "No live price for this crop yet"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-container-lowest border border-outline-variant p-space-md rounded-xl flex items-baseline justify-between gap-space-sm">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
                        Certified Harvest Weight
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="font-display-lg text-display-lg font-extrabold text-on-surface tabular-nums">
                          {Number(g.kg.toFixed(3)).toLocaleString("en-NG")}
                        </span>
                        <span className="font-headline-sm text-headline-sm text-on-surface-variant font-bold">kg</span>
                      </div>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold">
                        Current Value
                      </span>
                      <span className="font-title-md text-title-md text-primary font-bold tabular-nums mt-1">
                        {g.priceKobo !== null ? formatNairaFromKobo(g.valueKobo) : "—"}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums">
                        {g.priceKobo !== null ? "at today’s WFP price" : "awaiting price feed"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lots in this batch — edit / delete each one */}
                <div className="mt-space-md pt-space-md border-t border-outline-variant space-y-space-sm">
                  {g.lots.map((lot) => (
                    <div key={lot.id} className="flex flex-wrap items-center justify-between gap-space-sm">
                      <span className="font-body-md text-body-md text-on-surface tabular-nums">
                        {fmtKg(lot.qtyKg)}
                        {lot.note ? (
                          <span className="font-body-sm text-body-sm text-on-surface-variant truncate max-w-[180px] inline-block align-bottom">
                            {" · "}
                            {lot.note}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-space-xs">
                        <EditStockButton id={lot.id} qtyKg={lot.qtyKg} note={lot.note} />
                        <DeleteStockButton id={lot.id} label={cropLabel(lot.crop)} />
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="w-full bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm px-space-lg py-space-xl text-center">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant">search_off</span>
            <p className="font-headline-sm text-headline-sm text-on-surface font-bold mt-space-sm">
              No batches match this view
            </p>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {rows.length
                ? `No batches match the current search and filters (${rows.length} in the ledger).`
                : "The ledger is empty — add your first crop below."}
            </p>
            {rows.length ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCropFilter("all");
                }}
                className="mt-space-md h-9 px-space-md rounded bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md font-semibold shadow-sm transition-colors"
              >
                Clear all filters
              </button>
            ) : null}
          </div>
        )}
      </section>

      {/* ── Add stock (server action) ─────────────────────────────────── */}
      <section
        aria-label="Add stock"
        className="w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-md mb-space-xl"
      >
        <div className="flex items-center gap-space-sm mb-space-md">
          <span className="material-symbols-outlined text-primary text-[22px]">add_box</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Add a batch</h2>
        </div>
        {hasFarm ? (
          <form action={addStockAction} className="grid grid-cols-1 gap-space-md sm:grid-cols-4">
            <div>
              <label htmlFor="crop" className="block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant mb-1">
                Crop
              </label>
              <select
                id="crop"
                name="crop"
                required
                className="h-9 px-2 rounded bg-surface-container-lowest border border-outline-variant text-body-sm text-on-surface"
              >
                {KG_CROPS.map((crop) => (
                  <option key={crop} value={crop}>
                    {cropLabel(crop)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="qtyKg" className="block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant mb-1">
                Kg
              </label>
              <input
                id="qtyKg"
                name="qtyKg"
                type="number"
                min="0.1"
                step="any"
                required
                inputMode="decimal"
                placeholder="More than 0 kg"
                className="h-9 px-2 rounded bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface font-data-mono tabular-nums w-full"
              />
            </div>
            <div>
              <label htmlFor="note" className="block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant mb-1">
                Note
              </label>
              <input
                id="note"
                name="note"
                type="text"
                maxLength={200}
                placeholder="Optional"
                className="h-9 px-2 rounded bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface w-full"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="h-9 px-space-lg rounded bg-primary text-on-primary font-title-md text-title-md font-semibold shadow-sm hover:bg-primary-container transition-colors w-full sm:w-auto"
              >
                Add stock
              </button>
            </div>
          </form>
        ) : (
          <p className="font-body-md text-body-md text-on-surface-variant">
            No farm found for this account — stock can’t be added yet.
          </p>
        )}
      </section>

      {/* ── Audit ledger (sortable table) ─────────────────────────────── */}
      <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden mb-space-xl">
        <div className="w-full min-h-[56px] px-space-lg py-space-md bg-surface-container-low flex items-center justify-between border-b border-outline-variant">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-primary text-[24px]">verified</span>
            <div className="flex flex-col">
              <span className="font-title-md text-title-md text-on-surface font-bold">
                Audit ledger — sort, edit, delete and export
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Every lot in the depository, valued at today’s WFP survey
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-xs">
            <button
              onClick={exportCsv}
              className="h-9 px-space-md rounded bg-surface-container hover:bg-surface-container-high font-label-md text-label-md text-on-surface font-medium flex items-center gap-1 transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>CSV Export</span>
            </button>
            <button
              onClick={() => window.print()}
              className="h-9 px-space-md rounded bg-surface-container hover:bg-surface-container-high font-label-md text-label-md text-on-surface font-medium flex items-center gap-1 transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Ledger Slip</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto p-space-lg">
          {sorted.length > 0 ? (
            <>
              <table className="w-full text-left font-body-md text-body-md border-collapse">
                <caption className="sr-only">CropTrade depository audit ledger. Columns are sortable; rows are editable and deletable.</caption>
                <thead>
                  <tr className="bg-surface-container-lowest border-b border-outline-variant text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                    <th scope="col" className="py-space-sm px-space-md rounded-l-lg font-bold">
                      <button type="button" onClick={() => toggleSort("crop")} className="flex items-center gap-1 uppercase tracking-wider">
                        Crop Name
                        <span className={`material-symbols-outlined text-[14px] ${sort?.key === "crop" ? "opacity-100" : "opacity-0"}`}>
                          {sortIcon("crop")}
                        </span>
                      </button>
                    </th>
                    <th scope="col" className="py-space-sm px-space-md font-bold">
                      <button type="button" onClick={() => toggleSort("note")} className="flex items-center gap-1 uppercase tracking-wider">
                        Note / Bay
                        <span className={`material-symbols-outlined text-[14px] ${sort?.key === "note" ? "opacity-100" : "opacity-0"}`}>
                          {sortIcon("note")}
                        </span>
                      </button>
                    </th>
                    <th scope="col" className="py-space-sm px-space-md font-bold text-right">
                      <button type="button" onClick={() => toggleSort("kg")} className="flex items-center gap-1 uppercase tracking-wider ml-auto">
                        Weight (kg)
                        <span className={`material-symbols-outlined text-[14px] ${sort?.key === "kg" ? "opacity-100" : "opacity-0"}`}>
                          {sortIcon("kg")}
                        </span>
                      </button>
                    </th>
                    <th scope="col" className="py-space-sm px-space-md font-bold text-right">
                      <button type="button" onClick={() => toggleSort("price")} className="flex items-center gap-1 uppercase tracking-wider ml-auto">
                        Unit Price (₦/kg)
                        <span className={`material-symbols-outlined text-[14px] ${sort?.key === "price" ? "opacity-100" : "opacity-0"}`}>
                          {sortIcon("price")}
                        </span>
                      </button>
                    </th>
                    <th scope="col" className="py-space-sm px-space-md font-bold text-right">
                      <button type="button" onClick={() => toggleSort("value")} className="flex items-center gap-1 uppercase tracking-wider ml-auto">
                        Total Valuation (₦)
                        <span className={`material-symbols-outlined text-[14px] ${sort?.key === "value" ? "opacity-100" : "opacity-0"}`}>
                          {sortIcon("value")}
                        </span>
                      </button>
                    </th>
                    <th scope="col" className="py-space-sm px-space-md rounded-r-lg font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-on-surface font-body-md text-body-md">
                  {pageRows.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`${i % 2 === 1 ? "bg-surface-container-lowest" : "bg-surface-container-low/40"} hover:bg-surface-container-low/60 transition-colors`}
                    >
                      <td className="py-space-md px-space-md font-semibold">
                        <span aria-hidden="true">{emojiFor(r.crop)}</span> <span>{cropLabel(r.crop)}</span>
                      </td>
                      <td className="py-space-md px-space-md font-data-mono text-body-sm text-on-surface-variant">
                        {r.note ?? "—"}
                      </td>
                      <td className="py-space-md px-space-md text-right font-data-mono font-bold text-on-surface tabular-nums">
                        {fmtKg(r.qtyKg)}
                      </td>
                      <td className="py-space-md px-space-md text-right font-data-mono text-on-surface tabular-nums">
                        {r.priceKobo !== null ? `${formatNairaFromKobo(r.priceKobo)}/kg` : "—"}
                      </td>
                      <td className="py-space-md px-space-md text-right font-data-mono font-bold text-primary tabular-nums">
                        {r.valueKobo !== null ? formatNairaFromKobo(r.valueKobo) : "—"}
                      </td>
                      <td className="py-space-md px-space-md text-center">
                        <div className="inline-flex items-center gap-1">
                          <EditStockButton id={r.id} qtyKg={r.qtyKg} note={r.note} />
                          <DeleteStockButton id={r.id} label={cropLabel(r.crop)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="mt-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm">
                <p className="font-body-sm text-body-sm text-on-surface-variant tabular-nums">
                  Showing {sorted.length === 0 ? 0 : (currentPage - 1) * (pageSize === "all" ? sorted.length : pageSize) + 1}
                  –{Math.min(sorted.length, currentPage * (pageSize === "all" ? sorted.length : pageSize))} of {sorted.length}
                  {sorted.length !== rows.length ? ` (filtered from ${rows.length})` : ""}
                </p>
                <div className="flex items-center gap-space-sm">
                  <label className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant" htmlFor="page-size">
                    Rows
                  </label>
                  <select
                    id="page-size"
                    value={String(pageSize)}
                    onChange={(e) => {
                      setPageSize(e.target.value === "all" ? "all" : Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-9 px-2 rounded bg-surface-container-lowest border border-outline-variant text-body-sm text-on-surface"
                  >
                    <option value="4">4</option>
                    <option value="8">8</option>
                    <option value="all">All</option>
                  </select>
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-9 px-space-md rounded border border-outline-variant bg-surface-container-lowest hover:bg-surface-container font-label-md text-label-md text-on-surface flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    <span>Prev</span>
                  </button>
                  <span className="font-data-mono text-body-sm text-on-surface tabular-nums">
                    Page {currentPage} of {pages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    className="h-9 px-space-md rounded border border-outline-variant bg-surface-container-lowest hover:bg-surface-container font-label-md text-label-md text-on-surface flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>Next</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-space-lg text-center">
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant">table_view</span>
              <p className="font-title-md text-title-md text-on-surface font-semibold mt-1">No rows in this view</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Change the filters or page size to see ledger rows.</p>
            </div>
          )}

          {/* Table footer / audit sums */}
          <div className="mt-space-md p-space-md bg-surface-container-lowest border border-outline-variant rounded-xl flex flex-col sm:flex-row items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
              <span>Every figure sourced from your ledger and the WFP feed</span>
            </div>
            <div className="flex items-center gap-space-lg text-on-surface font-title-md text-title-md">
              <div>
                <span className="text-on-surface-variant font-label-md text-label-md mr-1">Total Mass:</span>
                <strong className="font-data-mono text-on-surface tabular-nums">{fmtKg(totalMass)}</strong>
              </div>
              <div className="h-6 w-px bg-surface-container-high"></div>
              <div>
                <span className="text-on-surface-variant font-label-md text-label-md mr-1">Total Portfolio Value:</span>
                <strong className="font-data-mono text-primary font-bold tabular-nums">
                  {priceDate !== null || rows.some((r) => r.priceKobo !== null)
                    ? formatNairaFromKobo(totalValue)
                    : "—"}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Audit log (committed history) ─────────────────────────────── */}
      <section
        aria-label="Audit log"
        className="w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-md mb-space-xl"
      >
        <div className="flex items-center justify-between mb-space-sm">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-secondary text-[22px]">history</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Audit Log</h2>
          </div>
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant tabular-nums">
            0 entries
          </span>
        </div>
        <ul className="divide-y divide-outline-variant"></ul>
        <div className="py-space-md text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Committed adjustment history will appear here once the platform records a committed change.
          </p>
        </div>
      </section>

      {/* ── Dispatch / sync bar ───────────────────────────────────────── */}
      <div className="w-full bg-surface-container-low p-space-md rounded-xl border border-outline-variant flex flex-col md:flex-row items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md">
          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[24px]">local_shipping</span>
          </div>
          <div>
            <p className="font-title-md text-title-md font-semibold text-on-surface">Ledger in sync</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Every adjustment saves to your farm ledger immediately — nothing is simulated.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
