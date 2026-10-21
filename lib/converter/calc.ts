// Money-converter pure logic — conversion, settlement arithmetic, currency
// formatting and the parity slip. No network, no DOM, no seeded numbers: the
// page passes live rates and the farm's own settings in, and the tests exercise
// every function directly. If a rate is missing the caller gets null and shows
// an error instead of a number made up here.

export interface CurrencyMeta {
  sym: string;
  name: string;
  /** Fraction digits for display (XOF/NGN-style currencies use 0). */
  dp: number;
  /** Region note shown under the parity index rows. */
  note: string;
}

/** Static display metadata only — every *rate* comes from the live FX provider. */
export const CURRENCY_META: Record<string, CurrencyMeta> = {
  NGN: { sym: "₦", name: "Nigerian Naira", dp: 0, note: "Domestic booking" },
  USD: { sym: "$", name: "US Dollar", dp: 2, note: "North America" },
  EUR: { sym: "€", name: "Euro", dp: 2, note: "Eurozone" },
  GBP: { sym: "£", name: "UK Sterling", dp: 2, note: "United Kingdom" },
  GHS: { sym: "GH₵", name: "Ghanaian Cedi", dp: 2, note: "West Africa" },
  KES: { sym: "KSh ", name: "Kenyan Shilling", dp: 2, note: "East Africa" },
  ZAR: { sym: "R", name: "South African Rand", dp: 2, note: "Southern Africa" },
  XOF: { sym: "CFA ", name: "West African CFA", dp: 0, note: "UEMOA" },
};

export function metaOf(code: string): CurrencyMeta {
  return (
    CURRENCY_META[code] ?? { sym: `${code} `, name: "Custom pairing", dp: 2, note: "Custom" }
  );
}

/** "601,690" / "1_500.5" / " 99 " → number. NaN when it is not a usable amount. */
export function parseAmount(raw: string | null | undefined): number {
  if (raw === null || raw === undefined) return NaN;
  const cleaned = String(raw).replace(/[\s,_]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return NaN;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function roundTo(value: number, dp: number): number {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

export function fmt(value: number, dp = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export function money(value: number, code: string): string {
  const meta = metaOf(code);
  return `${meta.sym}${fmt(value, meta.dp)}`;
}

/** "−$12.00"; a rounded-to-zero deduction reads as an empty string, never "−$0.00". */
export function signed(value: number, code: string): string {
  const meta = metaOf(code);
  const rounded = roundTo(Math.abs(value), meta.dp);
  return rounded === 0 ? "" : `−${meta.sym}${fmt(rounded, meta.dp)}`;
}

export function pct(value: number, dp = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${fmt(value, dp)}%`;
}

export interface SettlementInput {
  /** Valuation in naira (the booking currency of this converter). */
  amountNgn: number;
  /** Live rate: 1 settlement unit = X naira. */
  recvRate: number;
  /** Handling buffer percentage, 1.0–5.0. */
  bufferPct: number;
  /** Farm's export cost percentage from Settings (0–100). */
  exportCostPct: number;
}

export interface SettlementMetrics {
  gross: number;
  buffer: number;
  exportCosts: number;
  /** buffer + exportCosts, in the settlement currency. */
  deductions: number;
  net: number;
  /** True when deductions exceed the gross — below break-even. */
  shortfall: boolean;
}

/**
 * Gross = amount ÷ rate; deductions = gross × (buffer + export cost) %.
 * Net is clamped at 0 and `shortfall` tells the UI so the warning is explicit.
 */
export function settlement(input: SettlementInput): SettlementMetrics {
  const { amountNgn, recvRate, bufferPct, exportCostPct } = input;
  if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
    return { gross: 0, buffer: 0, exportCosts: 0, deductions: 0, net: 0, shortfall: false };
  }
  if (!Number.isFinite(recvRate) || recvRate <= 0) {
    return { gross: 0, buffer: 0, exportCosts: 0, deductions: 0, net: 0, shortfall: false };
  }
  const gross = amountNgn / recvRate;
  const buffer = gross * (clamp(bufferPct, 1, 5) / 100);
  const exportCosts = gross * (Math.max(0, exportCostPct) / 100);
  const deductions = buffer + exportCosts;
  const netRaw = gross - deductions;
  return {
    gross,
    buffer,
    exportCosts,
    deductions,
    net: Math.max(0, netRaw),
    shortfall: netRaw < 0,
  };
}

export interface SlipInput {
  reference: string;
  generatedAt: string; // pre-formatted stamp from the caller (APP_TZ aware)
  sendCode: string;
  sendAmount: number;
  recvCode: string;
  recvRate: number;
  rateNote: string; // provenance line, e.g. "Live · Exchange Rate API, 20 Oct 2026"
  bufferPct: number;
  exportCostPct: number;
  metrics: SettlementMetrics;
  accountLabel: string | null;
  chartCode: string;
  inspectedDate: string;
  inspectedRate: number;
  inspectedChangeDay: number | null;
  inspectedChangeWindow: number;
  windowLow: number;
  windowHigh: number;
  windowMean: number;
}

function row(label: string, value: string): string {
  return `  ${label.padEnd(26)}${value}`;
}

/**
 * The downloadable parity slip: plain text built only from what the caller
 * passes — live rate, its provenance, the buffer, the farm's export cost and
 * the inspected chart point. Nothing is invented here.
 */
export function buildSlip(input: SlipInput): string {
  const { metrics } = input;
  const recv = metaOf(input.recvCode);
  const send = metaOf(input.sendCode);
  const dp = recv.dp;
  const lines = [
    "CROPTRADE · EXPORT PARITY SLIP",
    "==================================================",
    row("Reference", input.reference),
    row("Generated", input.generatedAt),
    "",
    "CONVERSION",
    row("You send", `${input.sendCode} ${fmt(input.sendAmount, send.dp)}`),
    row("Rate", `1 ${input.recvCode} = NGN ${fmt(input.recvRate, 2)}`),
    row("Rate provenance", input.rateNote),
    row("They receive (gross)", `${input.recvCode} ${fmt(metrics.gross, dp)}`),
    "",
    "SETTLEMENT",
    row("Handling buffer", `${input.bufferPct.toFixed(1)}%  =  ${input.recvCode} ${fmt(metrics.buffer, dp)}`),
    row("Export costs", `${input.exportCostPct.toFixed(1)}%  =  ${input.recvCode} ${fmt(metrics.exportCosts, dp)}`),
    row("Total deductions", `${input.recvCode} ${fmt(metrics.deductions, dp)}`),
    row("NET REALIZED RECOVERY", `${input.recvCode} ${fmt(metrics.net, dp)}`),
    row("Destination", input.accountLabel ?? "Unassigned"),
    metrics.shortfall ? row("WARNING", "Deductions exceed gross — below break-even") : "",
    "",
    `FX CONTEXT · ${input.chartCode}/NGN, saved rate history`,
    row("Inspected day", input.inspectedDate),
    row("Rate on that day", `NGN ${fmt(input.inspectedRate, 2)}`),
    row(
      "Change on the day",
      input.inspectedChangeDay === null ? "first day in window" : pct(input.inspectedChangeDay)
    ),
    row("Change over window", pct(input.inspectedChangeWindow)),
    row("Window low / high", `${fmt(input.windowLow, 2)} / ${fmt(input.windowHigh, 2)}`),
    row("Window mean", fmt(input.windowMean, 2)),
    "",
    "PROVENANCE",
    "  Rates come from the live provider on the Rates page; history rows are",
    "  the saved FxTick records for this currency. Export costs are the farm's",
    "  own Settings value. No sample or demonstration numbers are used.",
    "",
    "Generated by CropTrade",
  ].filter((line) => line !== "");
  return lines.join("\n");
}
