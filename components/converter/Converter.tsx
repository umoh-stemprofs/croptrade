"use client";

// Money Converter (S-CONVERT) — every rate on this screen comes from the live FX
// provider (USD/EUR/GBP via the Rates pipeline, GHS/KES/ZAR/XOF cross-rated live)
// and every deduction is either the buffer the user sets or the farm's own export
// cost from Settings. Custom pairings, destination accounts and the ledger are
// the user's own inputs, stored on this device. Nothing here is a sample number;
// when a rate or history is missing the card says so instead of inventing one.

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataSourceBadge, type BadgeSpec } from "@/components/DataSourceBadge";
import { ChartCard, type ChartTableSpec } from "@/components/charts/ChartCard";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/Field";
import { useChartColors } from "@/lib/theme";
import { compactNaira, longDate, shortDate } from "@/lib/charts";
import { formatDateHuman } from "@/lib/format";
import {
  buildSlip,
  clamp,
  fmt,
  metaOf,
  money,
  parseAmount,
  pct,
  roundTo,
  settlement,
  signed,
  type SettlementMetrics,
} from "@/lib/converter/calc";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const QUICK_LOTS: { label: string; add: number }[] = [
  { label: "+₦250k", add: 250_000 },
  { label: "+₦1M", add: 1_000_000 },
];

export interface ConverterRate {
  quote: string;
  localPerForeign: number;
  date: string; // YYYY-MM-DD
  source: "LIVE" | "MANUAL" | "SAVED";
  old: boolean;
}

export interface HistoryPoint {
  date: string; // YYYY-MM-DD
  localPerForeign: number;
  source: string;
}

export interface DestinationAccount {
  id: string;
  label: string;
  ccy: string;
}

export interface LedgerRow {
  ref: string;
  ts: string;
  send: string;
  recv: string;
  ngn: number;
  net: number;
  buffer: number;
  account: string;
}

export interface ConverterProps {
  /** Live/saved/manual rates: USD, EUR, GBP plus whichever corridor codes resolved. */
  rates: ConverterRate[];
  /** Saved FxTick history per quote, oldest first. */
  history: Record<string, HistoryPoint[]>;
  /** The farm's own export cost percentage (Settings). */
  exportCostPct: number;
  /** Total stock value in naira, or null when there is no priced stock. */
  defaultAmountNgn: number | null;
}

// ---------------------------------------------------------------- persistence

const KEY = {
  recv: "croptrade_conv_recv",
  buffer: "croptrade_conv_buffer",
  accounts: "croptrade_conv_accounts",
  custom: "croptrade_conv_custom",
  ledger: "croptrade_conv_ledger",
  ref: "croptrade_conv_ref",
} as const;

function readJson<T>(key: string, fallback: T, validate: (value: unknown) => T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return validate(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode — keep working in memory.
  }
}

function readText(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeText(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode.
  }
}

function validateAccounts(value: unknown): DestinationAccount[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (row): row is DestinationAccount =>
        !!row &&
        typeof row === "object" &&
        typeof (row as DestinationAccount).label === "string" &&
        ((row as DestinationAccount).label || "").trim() !== "" &&
        typeof (row as DestinationAccount).ccy === "string" &&
        /^[A-Z]{3}$/.test((row as DestinationAccount).ccy)
    )
    .map((row) => ({ ...row, id: String(row.id ?? row.ccy + row.label) }));
}

function validateCustom(value: unknown): { code: string; rate: number }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is { code: string; rate: number } => {
      const pair = row as { code?: unknown; rate?: unknown };
      return (
        typeof pair?.code === "string" &&
        /^[A-Z]{3}$/.test(pair.code) &&
        typeof pair?.rate === "number" &&
        Number.isFinite(pair.rate) &&
        pair.rate > 0
      );
    })
    .slice(0, 6);
}

function validateLedger(value: unknown): LedgerRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is LedgerRow => {
      const entry = row as LedgerRow;
      return (
        !!entry &&
        typeof entry === "object" &&
        typeof entry.ref === "string" &&
        typeof entry.recv === "string" &&
        Number.isFinite(entry.net)
      );
    })
    .slice(0, 12);
}

function rateBadge(rate: ConverterRate | undefined): BadgeSpec | undefined {
  if (!rate) return undefined;
  switch (rate.source) {
    case "LIVE":
      return { kind: "live", note: "FX" };
    case "MANUAL":
      return { kind: "manual" };
    default:
      return { kind: "saved", ageLabel: formatDateHuman(rate.date) };
  }
}

function rateNote(rate: ConverterRate | undefined): string {
  if (!rate) return "No rate available";
  const when = formatDateHuman(rate.date);
  switch (rate.source) {
    case "LIVE":
      return `Live · Exchange Rate API, ${when}`;
    case "MANUAL":
      return `Manual rate, ${when}`;
    default:
      return `Saved data, ${when}`;
  }
}

// ---------------------------------------------------------------- sub-sections

function labelClass(): string {
  return "block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant";
}

function SectionCard({
  title,
  hint,
  badge,
  children,
  labelledBy,
}: {
  title: string;
  hint?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-space-md sm:p-space-lg"
    >
      <div className="flex flex-wrap items-start justify-between gap-space-sm">
        <div>
          <h2 id={labelledBy} className="font-title-md text-title-md text-on-surface font-semibold">
            {title}
          </h2>
          {hint ? (
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{hint}</p>
          ) : null}
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- main component

export function Converter({
  rates,
  history,
  exportCostPct,
  defaultAmountNgn,
}: ConverterProps) {
  const colors = useChartColors();

  const rateMap = useMemo(() => new Map(rates.map((row) => [row.quote, row])), [rates]);
  const baseCodes = useMemo(() => ["NGN", ...rates.map((row) => row.quote)], [rates]);

  // Hydrated from localStorage after mount (SSR renders the defaults).
  const [hydrated, setHydrated] = useState(false);
  const [customPairs, setCustomPairs] = useState<{ code: string; rate: number }[]>([]);
  const [accounts, setAccounts] = useState<DestinationAccount[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [sendCode, setSendCode] = useState("NGN");
  const [recvCode, setRecvCode] = useState("USD");
  const [bufferPct, setBufferPct] = useState(2);
  const [accountId, setAccountId] = useState("");
  const [reference, setReference] = useState("EXP-0000");

  // Canonical naira amount: real state, not derived from the input being typed
  // into — so blurring a field (which stops the edit) never zeroes the amount.
  const [amountNgn, setAmountNgn] = useState(() => defaultAmountNgn ?? 0);
  const [editText, setEditText] = useState("");
  const [editing, setEditing] = useState<"send" | "recv" | null>(null);

  const [customOpen, setCustomOpen] = useState(false);
  const [customAmountText, setCustomAmountText] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newRate, setNewRate] = useState("");
  const [formError, setFormError] = useState("");
  const [newAccountLabel, setNewAccountLabel] = useState("");
  const [newAccountCcy, setNewAccountCcy] = useState("USD");
  const [accountError, setAccountError] = useState("");

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [pinIdx, setPinIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const storedRecv = readText(KEY.recv, "USD");
    const storedBuffer = Number(readText(KEY.buffer, "2"));
    const storedRef = readText(KEY.ref, "");
    const ref =
      storedRef || `EXP-${1000 + Math.floor(Math.random() * 9000)}`;
    setRecvCode(storedRecv);
    setBufferPct(Number.isFinite(storedBuffer) ? clamp(storedBuffer, 1, 5) : 2);
    setReference(ref);
    writeText(KEY.ref, ref);
    setCustomPairs(
      readJson(KEY.custom, [], (value) => validateCustom(value))
    );
    setAccounts(readJson(KEY.accounts, [], (value) => validateAccounts(value)));
    setLedger(readJson(KEY.ledger, [], (value) => validateLedger(value)));
    setHydrated(true);
  }, []);

  const codes = useMemo(() => {
    const list = [...baseCodes];
    for (const pair of customPairs) {
      if (!list.includes(pair.code)) list.push(pair.code);
    }
    return list;
  }, [baseCodes, customPairs]);

  const rateOf = (code: string): number | null => {
    if (code === "NGN") return 1;
    const pair = customPairs.find((p) => p.code === code);
    if (pair) return pair.rate;
    return rateMap.get(code)?.localPerForeign ?? null;
  };

  // Keep currencies valid when rates/custom pairs change underneath us.
  useEffect(() => {
    if (!hydrated) return;
    if (!codes.includes(recvCode)) setRecvCode(codes.includes("USD") ? "USD" : (codes[1] ?? "USD"));
  }, [codes, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recvCode === sendCode) {
      setSendCode(recvCode === "NGN" ? "USD" : "NGN");
    }
  }, [recvCode, sendCode]);

  const recvRate = rateOf(recvCode);
  const sendRate = rateOf(sendCode);

  const defaultNaira = defaultAmountNgn ?? 0;

  const metrics: SettlementMetrics = useMemo(
    () => settlement({ amountNgn, recvRate: recvRate ?? 0, bufferPct, exportCostPct }),
    [amountNgn, recvRate, bufferPct, exportCostPct]
  );

  // The field being typed in shows the raw text; the other shows the converted
  // amount derived from the canonical naira value.
  const displaySend = useMemo(() => {
    if (editing === "send") return editText;
    if (!sendRate) return "";
    return String(roundTo(amountNgn / sendRate, metaOf(sendCode).dp));
  }, [editing, sendCode, sendRate, amountNgn, editText]);

  const displayRecv = useMemo(() => {
    if (editing === "recv") return editText;
    if (!recvRate) return "";
    return String(roundTo(amountNgn / recvRate, metaOf(recvCode).dp));
  }, [editing, recvCode, recvRate, amountNgn, editText]);

  // ---------------------------------------------------------------- chart

  const chartCode = recvCode === "NGN" ? (sendCode === "NGN" ? "USD" : sendCode) : recvCode;
  const series = history[chartCode] ?? [];
  const hasChart = series.length >= 2;

  const chartData = series.map((point) => ({
    date: point.date,
    rate: point.localPerForeign,
  }));

  const stats = useMemo(() => {
    if (!hasChart) return null;
    const values = series.map((p) => p.localPerForeign);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const returns: number[] = [];
    for (let i = 1; i < values.length; i++) {
      returns.push(((values[i] - values[i - 1]) / values[i - 1]) * 100);
    }
    const variance =
      returns.length > 0
        ? returns.reduce((sum, r) => sum + r * r, 0) / returns.length
        : 0;
    const change = ((values[values.length - 1] - values[0]) / values[0]) * 100;
    return { lo, hi, mean, vol: Math.sqrt(variance), change };
  }, [series, hasChart]);

  const inspectIdx = clamp(
    hoverIdx ?? pinIdx ?? series.length - 1,
    0,
    Math.max(0, series.length - 1)
  );
  const inspected = hasChart ? series[inspectIdx] : null;
  const inspectedD1 =
    hasChart && inspectIdx > 0
      ? ((series[inspectIdx].localPerForeign - series[inspectIdx - 1].localPerForeign) /
          series[inspectIdx - 1].localPerForeign) *
        100
      : null;
  const inspectedWindow =
    hasChart && series[0].localPerForeign > 0
      ? ((series[inspectIdx].localPerForeign - series[0].localPerForeign) /
          series[0].localPerForeign) *
        100
      : 0;
  const bandPosition =
    hasChart && stats && stats.hi > stats.lo
      ? ((series[inspectIdx].localPerForeign - stats.lo) / (stats.hi - stats.lo)) * 100
      : 50;

  const chartTable: ChartTableSpec = {
    columns: ["Date", "Rate (₦ per unit)", "Source"],
    rows: [...series]
      .reverse()
      .map((point) => [
        shortDate(point.date),
        `₦${fmt(point.localPerForeign, 2)}`,
        point.source === "LIVE"
          ? "Live"
          : point.source === "MANUAL"
            ? "Manual"
            : "Saved data",
      ]),
    note: "One row per saved rate date. Missing days are not filled in.",
  };

  // ---------------------------------------------------------------- actions

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  function onSendChange(value: string) {
    setEditing("send");
    setEditText(value);
    const parsed = parseAmount(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      setAmountNgn(sendRate ? parsed * sendRate : 0);
    }
  }

  function onRecvChange(value: string) {
    setEditing("recv");
    setEditText(value);
    const parsed = parseAmount(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      setAmountNgn(recvRate ? parsed * recvRate : 0);
    }
  }

  function commitEditing() {
    setEditing(null);
  }

  function swap() {
    setSendCode(recvCode);
    setRecvCode(sendCode);
    writeText(KEY.recv, sendCode);
    commitEditing();
  }

  function setBuffer(value: number) {
    const next = clamp(value, 1, 5);
    setBufferPct(next);
    writeText(KEY.buffer, String(next));
  }

  const matchingAccounts = accounts.filter((account) => account.ccy === recvCode);
  const selectedAccount =
    accounts.find((account) => account.id === accountId) ?? matchingAccounts[0] ?? null;

  useEffect(() => {
    if (hydrated && selectedAccount && selectedAccount.id !== accountId) {
      setAccountId(selectedAccount.id);
    }
  }, [hydrated, selectedAccount, accountId]);

  function addAccount() {
    const label = newAccountLabel.trim();
    if (label === "") {
      setAccountError("Give the account a name, for example “GTB export desk”.");
      return;
    }
    if (!/^[A-Z]{3}$/.test(newAccountCcy)) {
      setAccountError("Choose the currency this account settles in.");
      return;
    }
    const account: DestinationAccount = {
      id: `acct-${Date.now()}-${accounts.length}`,
      label,
      ccy: newAccountCcy,
    };
    const next = [...accounts, account];
    setAccounts(next);
    writeJson(KEY.accounts, next);
    setAccountId(account.id);
    setNewAccountLabel("");
    setAccountError("");
    showToast(`Destination account added · ${account.ccy}`);
  }

  function removeAccount(id: string) {
    const next = accounts.filter((account) => account.id !== id);
    setAccounts(next);
    writeJson(KEY.accounts, next);
    if (accountId === id) setAccountId("");
  }

  function addCustomPair() {
    const code = newCode.trim().toUpperCase();
    const rate = parseAmount(newRate);
    if (!/^[A-Z]{3}$/.test(code)) {
      setFormError("Use a three-letter code, for example TZS.");
      return;
    }
    if (codes.includes(code)) {
      setFormError(`${code} is already in the corridor.`);
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      setFormError("Enter the rate as a number above 0.");
      return;
    }
    if (customPairs.length >= 6) {
      setFormError("Six custom pairs is the limit — remove one first.");
      return;
    }
    const next = [...customPairs, { code, rate: roundTo(rate, 4) }];
    setCustomPairs(next);
    writeJson(KEY.custom, next);
    setNewCode("");
    setNewRate("");
    setFormError("");
    showToast(`${code} pairing added · you set ₦${fmt(rate, 2)}`);
  }

  function removeCustomPair(code: string) {
    const next = customPairs.filter((pair) => pair.code !== code);
    setCustomPairs(next);
    writeJson(KEY.custom, next);
    if (recvCode === code) setRecvCode("USD");
    if (sendCode === code) setSendCode("NGN");
  }

  function saveSettlement() {
    if (!Number.isFinite(amountNgn) || amountNgn <= 0 || recvRate === null) {
      showToast("Enter an amount first");
      return;
    }
    const row: LedgerRow = {
      ref: reference,
      ts: new Date().toISOString(),
      send: sendCode,
      recv: recvCode,
      ngn: Math.round(amountNgn),
      net: roundTo(metrics.net, metaOf(recvCode).dp),
      buffer: bufferPct,
      account: selectedAccount?.label ?? "Unassigned",
    };
    const next = [row, ...ledger].slice(0, 12);
    setLedger(next);
    writeJson(KEY.ledger, next);
    showToast(metrics.shortfall ? "Saved (below break-even)" : "Settlement saved");
  }

  function removeLedgerRow(index: number) {
    const next = ledger.filter((_, i) => i !== index);
    setLedger(next);
    writeJson(KEY.ledger, next);
  }

  function downloadSlip() {
    if (!hasChart || !recvRate || recvRate <= 0) return;
    const text = buildSlip({
      reference,
      generatedAt: new Date().toISOString(),
      sendCode,
      sendAmount: roundTo(amountNgn / (sendRate ?? 1), metaOf(sendCode).dp),
      recvCode,
      recvRate,
      rateNote: rateNote(rateMap.get(recvCode)),
      bufferPct,
      exportCostPct,
      metrics,
      accountLabel: selectedAccount?.label ?? null,
      chartCode,
      inspectedDate: inspected ? longDate(inspected.date) : "—",
      inspectedRate: inspected?.localPerForeign ?? 0,
      inspectedChangeDay: inspectedD1,
      inspectedChangeWindow: inspectedWindow,
      windowLow: stats?.lo ?? 0,
      windowHigh: stats?.hi ?? 0,
      windowMean: stats?.mean ?? 0,
    });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `croptrade-parity-slip-${reference}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast("Parity slip downloaded");
  }

  function chartKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!hasChart) return;
    const last = series.length - 1;
    const current = hoverIdx ?? pinIdx ?? last;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setHoverIdx(clamp(current - 1, 0, last));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setHoverIdx(clamp(current + 1, 0, last));
    } else if (event.key === "Home") {
      event.preventDefault();
      setHoverIdx(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHoverIdx(last);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setPinIdx(pinIdx === current ? null : current);
    }
  }

  const accountMismatch =
    selectedAccount !== null && selectedAccount.ccy !== recvCode;

  const sendMeta = metaOf(sendCode);
  const recvMeta = metaOf(recvCode);

  // ---------------------------------------------------------------- render

  return (
    <div className="flex flex-col w-full">
      {/* Telemetry bar — real corridor rates */}
      <section
        aria-label="Live corridor rates"
        className="w-full bg-surface-container-low rounded-xl px-space-md py-space-xs mb-space-lg flex flex-wrap items-center justify-between gap-space-sm shadow-sm"
      >
        <div className="flex items-center gap-space-sm flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-bold text-on-surface">
              Export rate corridor
            </span>
          </span>
          <span className="text-outline-variant">•</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-data-mono text-data-mono text-on-surface">
            {["USD", "EUR", "GBP"].map((code) => {
              const rate = rateMap.get(code);
              return (
                <span key={code} className="tabular-nums">
                  <span className="text-on-surface-variant">1 {code}</span>{" "}
                  <span className="font-semibold text-primary">
                    {rate ? `₦${fmt(rate.localPerForeign, 2)}` : "—"}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant tabular-nums">
          Rates of {rateMap.get("USD") ? formatDateHuman(rateMap.get("USD")!.date) : "—"} ·{" "}
          {rates.length} currencies live
        </p>
      </section>

      <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-space-lg lg:col-span-8">
          {/* Converter */}
          <SectionCard
            labelledBy="convert-h"
            title="Convert valuation"
            hint="Every quote reads “1 unit = ₦”. Edit either side — the other follows."
            badge={
              <span className="inline-flex items-center rounded-input border border-border bg-surface px-2.5 py-0.5 text-sm font-medium text-muted">
                Bidirectional
              </span>
            }
          >
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="conv-send" className={labelClass()}>
                  You send
                </label>
                <span className="text-sm leading-5 text-muted tabular-nums">
                  {sendCode === "NGN"
                    ? "Domestic booking"
                    : sendRate
                      ? `1 ${sendCode} = ₦${fmt(sendRate, 2)}`
                      : "No rate available"}
                </span>
              </div>
              <div className="flex h-14 items-center gap-3 rounded border border-outline-variant bg-surface-container-low px-3 focus-within:border-accent">
                <span className="text-[22px] font-bold text-muted tabular-nums select-none">
                  {sendMeta.sym}
                </span>
                <input
                  id="conv-send"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  value={displaySend}
                  onChange={(event) => onSendChange(event.target.value)}
                  onBlur={commitEditing}
                  disabled={sendRate === null}
                  aria-label={`Amount in ${sendCode}`}
                  className="h-12 w-full min-w-0 bg-transparent text-[26px] font-bold leading-9 outline-none tabular-nums disabled:opacity-50"
                />
                <select
                  value={sendCode}
                  onChange={(event) => setSendCode(event.target.value)}
                  aria-label="Send currency"
                  className={`${inputClass} mt-0 w-auto shrink-0`}
                >
                  {codes
                    .filter((code) => code !== recvCode)
                    .map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="my-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <button
                type="button"
                onClick={swap}
                className={`inline-flex h-12 items-center rounded-input border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-bg ${focusRing}`}
              >
                ⇅ Swap
              </button>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="conv-recv" className={labelClass()}>
                  They receive
                </label>
                <span className="text-sm leading-5 text-muted tabular-nums">
                  {recvRate ? `1 ${recvCode} = ₦${fmt(recvRate, 2)}` : "No rate available"}
                </span>
              </div>
              <div className="flex h-14 items-center gap-3 rounded border border-outline-variant bg-surface-container-low px-3 focus-within:border-accent">
                <span className="text-[22px] font-bold text-accent tabular-nums select-none">
                  {recvMeta.sym}
                </span>
                <input
                  id="conv-recv"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  value={displayRecv}
                  onChange={(event) => onRecvChange(event.target.value)}
                  onBlur={commitEditing}
                  disabled={recvRate === null}
                  aria-label={`Amount in ${recvCode}`}
                  className="h-12 w-full min-w-0 bg-transparent text-[26px] font-bold leading-9 text-accent outline-none tabular-nums disabled:opacity-50"
                />
                <select
                  value={recvCode}
                  onChange={(event) => setRecvCode(event.target.value)}
                  aria-label="Receive currency"
                  className={`${inputClass} mt-0 w-auto shrink-0`}
                >
                  {codes
                    .filter((code) => code !== sendCode)
                    .map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                </select>
              </div>
              {recvRate === null ? (
                <p className="mt-2 text-sm leading-5 text-danger">
                  The provider returned no rate for {recvCode} right now. Try again shortly or
                  pick another currency.
                </p>
              ) : null}
            </div>

            {/* Quick lots */}
            <div className="mt-4 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm font-medium leading-5 text-muted">
                  Quick lot (NGN)
                </span>
                {QUICK_LOTS.map((lot) => (
                  <button
                    key={lot.label}
                    type="button"
                    onClick={() => {
                      // Add on top of the current canonical amount.
                      setEditing(null);
                      setAmountNgn((current) => Math.round(current + lot.add));
                    }}
                    className={`inline-flex h-9 items-center rounded-input border border-border bg-bg px-3 text-sm font-semibold text-text hover:bg-surface ${focusRing} tabular-nums`}
                  >
                    {lot.label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-expanded={customOpen}
                  onClick={() => {
                    setCustomOpen(!customOpen);
                    setCustomAmountText(customOpen ? "" : String(Math.round(amountNgn)));
                  }}
                  className={`inline-flex h-9 items-center rounded-input border border-border bg-bg px-3 text-sm font-semibold text-text hover:bg-surface ${focusRing}`}
                >
                  Custom
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setAmountNgn(defaultNaira);
                  }}
                  className={`inline-flex h-9 items-center rounded-input border border-border bg-surface px-3 text-sm font-semibold text-muted hover:bg-bg ${focusRing} tabular-nums`}
                >
                  {defaultNaira > 0
                    ? `Reset to stock value ₦${fmt(defaultNaira, 0)}`
                    : "Reset to 0"}
                </button>
              </div>
              {customOpen ? (
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="conv-custom-amount" className={labelClass()}>
                      Exact NGN amount
                    </label>
                    <input
                      id="conv-custom-amount"
                      inputMode="decimal"
                      autoComplete="off"
                      value={customAmountText}
                      onChange={(event) => setCustomAmountText(event.target.value)}
                      className={`${inputClass} w-44 tabular-nums`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const value = parseAmount(customAmountText);
                      if (!Number.isFinite(value) || value < 0) return;
                      setEditing(null);
                      setAmountNgn(value);
                      setCustomOpen(false);
                    }}
                    className={`inline-flex h-12 items-center rounded-input bg-accent px-4 text-base font-semibold text-accent-fg hover:bg-accent-hover ${focusRing}`}
                  >
                    Apply amount
                  </button>
                </div>
              ) : null}
              {defaultAmountNgn === null ? (
                <p className="mt-2 text-sm leading-5 text-muted">
                  No priced stock yet — enter any amount, or add stock on the Stock page to
                  prefill your valuation.
                </p>
              ) : null}
            </div>
          </SectionCard>

          {/* Settlement engine */}
          <SectionCard
            labelledBy="settle-h"
            title="Settlement engine"
            hint="Buffer, export cost from your Settings, and the destination between gross and what lands."
            badge={
              <span className="inline-flex items-center rounded-input border border-border bg-surface px-2.5 py-0.5 text-sm font-medium text-muted">
                {selectedAccount ? selectedAccount.label : "No destination"}
              </span>
            }
          >
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="conv-buffer" className={labelClass()}>
                    Handling buffer
                  </label>
                  <output htmlFor="conv-buffer" className="text-sm font-semibold text-warning tabular-nums">
                    {bufferPct.toFixed(1)}%
                  </output>
                </div>
                <input
                  id="conv-buffer"
                  type="range"
                  min={1}
                  max={5}
                  step={0.1}
                  value={bufferPct}
                  onChange={(event) => setBuffer(Number(event.target.value))}
                  className="mt-2 w-full accent-accent"
                />
                <div className="mt-1 flex justify-between text-sm leading-5 text-muted tabular-nums">
                  <span>1.0%</span>
                  <span>3.0%</span>
                  <span>5.0%</span>
                </div>
                <p className="mt-1 text-sm leading-5 text-muted">
                  Hold-back on gross settlement for handling variance.
                </p>
              </div>
              <div>
                <span className={labelClass()}>Export destination</span>
                <select
                  value={selectedAccount?.id ?? ""}
                  onChange={(event) => setAccountId(event.target.value)}
                  aria-label="Export destination account"
                  className={`${inputClass} w-full`}
                >
                  {accounts.length === 0 ? (
                    <option value="">No accounts yet — add one below</option>
                  ) : (
                    accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label} · {account.ccy}
                      </option>
                    ))
                  )}
                </select>
                <p className="mt-1 text-sm leading-5 text-muted">
                  {selectedAccount
                    ? `${selectedAccount.ccy} settlement · saved on this device`
                    : "Accounts you add stay on this device."}
                </p>
              </div>
            </div>

            {accountMismatch ? (
              <p className="mt-4 rounded border border-tertiary/40 bg-tertiary/10 p-3 text-sm leading-5 text-warning">
                {selectedAccount!.label} settles in {selectedAccount!.ccy}, not {recvCode}. Pick
                a {recvCode} destination or add one before filing.
              </p>
            ) : null}

            {/* Destination account manager */}
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm font-medium leading-5 text-muted">Destination accounts</p>
              {accounts.length === 0 ? (
                <p className="mt-2 text-sm leading-5 text-muted">
                  None yet — add the accounts you actually settle into.
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {accounts.map((account) => (
                    <li
                      key={account.id}
                      className="inline-flex items-center gap-2 rounded-input border border-border bg-bg px-2.5 py-1 text-sm"
                    >
                      <span className="tabular-nums">
                        {account.label} · {account.ccy}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAccount(account.id)}
                        aria-label={`Remove ${account.label}`}
                        className={`text-muted hover:text-danger ${focusRing}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="grow">
                  <label htmlFor="conv-acct-label" className={labelClass()}>
                    Account name
                  </label>
                  <input
                    id="conv-acct-label"
                    value={newAccountLabel}
                    onChange={(event) => setNewAccountLabel(event.target.value)}
                    placeholder="GTB export desk"
                    className={`${inputClass} w-full`}
                  />
                </div>
                <div>
                  <label htmlFor="conv-acct-ccy" className={labelClass()}>
                    Currency
                  </label>
                  <select
                    id="conv-acct-ccy"
                    value={newAccountCcy}
                    onChange={(event) => setNewAccountCcy(event.target.value)}
                    className={`${inputClass} w-28`}
                  >
                    {codes
                      .filter((code) => code !== "NGN")
                      .map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addAccount}
                  className={`inline-flex h-12 items-center rounded-input border border-border bg-surface px-4 text-base font-semibold text-text hover:bg-bg ${focusRing}`}
                >
                  Add account
                </button>
              </div>
              {accountError ? (
                <p role="alert" className="mt-2 text-sm leading-5 text-danger">
                  {accountError}
                </p>
              ) : null}
            </div>

            {/* Deductions + net */}
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm font-medium leading-5 text-muted">Deductions</p>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted tabular-nums">
                    Handling buffer ({bufferPct.toFixed(1)}%)
                  </span>
                  <span className="font-semibold text-warning tabular-nums">
                    {signed(metrics.buffer, recvCode)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted tabular-nums">
                    Export costs ({exportCostPct.toFixed(1)}% · from Settings)
                  </span>
                  <span className="font-semibold text-text tabular-nums">
                    {signed(metrics.exportCosts, recvCode)}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-outline-variant bg-surface-container-low p-4">
                <div className="min-w-0">
                  <span className="block text-base font-semibold text-accent">
                    Net realized recovery
                  </span>
                  <span
                    className={`text-sm leading-5 ${metrics.shortfall ? "text-danger" : "text-muted"}`}
                  >
                    {metrics.shortfall
                      ? "Deductions exceed the gross — below break-even."
                      : `Gross ${money(metrics.gross, recvCode)} − ${money(metrics.deductions, recvCode)} in deductions`}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`block text-[26px] font-bold leading-8 tabular-nums ${
                      metrics.shortfall ? "text-danger" : "text-accent"
                    }`}
                  >
                    {money(metrics.net, recvCode)}
                  </span>
                  <span className="text-sm leading-5 text-muted">{recvCode}</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Volatility index — real saved history */}
          <ChartCard
            title={`${chartCode}/NGN · 30-day corridor`}
            badge={rateBadge(rateMap.get(chartCode)) ?? { kind: "saved", ageLabel: "history" }}
            table={chartTable}
            empty={
              hasChart
                ? undefined
                : {
                    message: `Not enough saved ${chartCode} history for a trend yet — the chart needs at least 2 saved rates. Today's live rate is ${rateMap.get(chartCode) ? `₦${fmt(rateMap.get(chartCode)!.localPerForeign, 2)}` : "unavailable"}.`,
                    action: { href: "/rates", label: "Open Rates" },
                  }
            }
            note={
              hasChart
                ? `${series.length} saved rate${series.length === 1 ? "" : "s"} from the FxTick history. Missing days stay missing.`
                : undefined
            }
            controls={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <select
                  value={chartCode}
                  onChange={(event) => {
                    const code = event.target.value;
                    setPinIdx(null);
                    setHoverIdx(null);
                    if (code === sendCode) setSendCode(recvCode === "NGN" ? "NGN" : sendCode);
                    setRecvCode(code);
                    writeText(KEY.recv, code);
                  }}
                  aria-label="Currency shown in the chart"
                  className={`${inputClass} w-auto`}
                >
                  {codes
                    .filter((code) => code !== "NGN")
                    .map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setPinIdx(series.length - 1);
                    setHoverIdx(null);
                  }}
                  className={`inline-flex h-12 items-center rounded-input border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-bg ${focusRing}`}
                >
                  Today
                </button>
              </div>
            }
          >
            {stats ? (
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  ["30d low", `₦${fmt(stats.lo, 2)}`],
                  ["30d high", `₦${fmt(stats.hi, 2)}`],
                  ["Mean", `₦${fmt(stats.mean, 2)}`],
                  ["Volatility", `${fmt(stats.vol, 2)}%`],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded border border-outline-variant bg-surface-container-low px-3 py-2"
                  >
                    <div className="text-xs font-semibold uppercase leading-4 tracking-wide text-muted">
                      {label}
                    </div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
                  </div>
                ))}
                <div className="rounded border border-outline-variant bg-surface-container-low px-3 py-2">
                  <div className="text-xs font-semibold uppercase leading-4 tracking-wide text-muted">
                    30d change
                  </div>
                  <div
                    className={`mt-1 text-sm font-semibold tabular-nums ${
                      stats.change >= 0 ? "text-accent" : "text-danger"
                    }`}
                  >
                    {pct(stats.change)}
                  </div>
                </div>
              </div>
            ) : null}

            <div
              tabIndex={0}
              role="group"
              aria-label="30-day exchange rate chart. Use left and right arrow keys to inspect a day, Enter to pin."
              onKeyDown={chartKey}
              onMouseLeave={() => setHoverIdx(null)}
              className={`rounded-input ${focusRing}`}
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
                  onMouseMove={(state: { activeTooltipIndex?: number } | undefined) => {
                    const index = state?.activeTooltipIndex;
                    if (typeof index === "number" && index !== hoverIdx) setHoverIdx(index);
                  }}
                  onClick={(state: { activeTooltipIndex?: number } | undefined) => {
                    const index = state?.activeTooltipIndex;
                    if (typeof index === "number") {
                      setPinIdx(pinIdx === index ? null : index);
                    }
                  }}
                >
                  <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => shortDate(value)}
                    tick={{ fontSize: 12, fill: colors.axis }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.max(1, Math.floor(chartData.length / 5))}
                    minTickGap={12}
                  />
                  <YAxis
                    width={68}
                    domain={["auto", "auto"]}
                    tickFormatter={(value: number) => compactNaira(value)}
                    tick={{ fontSize: 12, fill: colors.axis }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const point = payload[0]?.payload as
                        | { date: string; rate: number }
                        | undefined;
                      if (!point) return null;
                      return (
                        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant px-3 py-2 shadow-sm">
                          <p className="text-sm font-medium">{longDate(point.date)}</p>
                          <p className="text-sm text-muted tabular-nums">
                            ₦{fmt(point.rate, 2)} per {chartCode}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke={colors.series[0]}
                    strokeWidth={2}
                    dot={{ r: 2.5, strokeWidth: 0, fill: colors.series[0] }}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {inspected ? (
              <div className="mt-3 grid grid-cols-2 gap-2 rounded border border-outline-variant bg-surface-container-low p-3 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <div className="text-xs font-semibold uppercase leading-4 tracking-wide text-muted">
                    Inspected
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">
                    {longDate(inspected.date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase leading-4 tracking-wide text-muted">
                    Spot
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">
                    ₦{fmt(inspected.localPerForeign, 2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase leading-4 tracking-wide text-muted">
                    Δ 1 day
                  </div>
                  <div
                    className={`mt-1 text-sm font-semibold tabular-nums ${
                      inspectedD1 === null
                        ? "text-muted"
                        : inspectedD1 >= 0
                          ? "text-accent"
                          : "text-danger"
                    }`}
                  >
                    {inspectedD1 === null ? "—" : pct(inspectedD1)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase leading-4 tracking-wide text-muted">
                    Δ window
                  </div>
                  <div
                    className={`mt-1 text-sm font-semibold tabular-nums ${
                      inspectedWindow >= 0 ? "text-accent" : "text-danger"
                    }`}
                  >
                    {pct(inspectedWindow)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase leading-4 tracking-wide text-muted">
                    Band position
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">
                    {fmt(bandPosition, 0)}% of band
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase leading-4 tracking-wide text-muted">
                    At this rate
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums">
                    {money(amountNgn / inspected.localPerForeign, recvCode)}
                  </div>
                </div>
              </div>
            ) : null}
            <p className="mt-2 text-sm leading-5 text-muted">
              Hover, click, or focus and use ← → to inspect a day; Enter pins it.{" "}
              <span className="tabular-nums">
                {pinIdx === null
                  ? "No pin — showing the newest saved rate."
                  : `Pinned: ${longDate(series[pinIdx]?.date ?? series[series.length - 1]?.date ?? "")}.`}
              </span>
            </p>
          </ChartCard>

          {/* Custom pairings */}
          <SectionCard
            labelledBy="pairs-h"
            title="Custom regional pairings"
            hint="Add any currency code with the naira quote you were actually offered — you set the rate, it is labelled Manual."
          >
            <form
              className="mt-4 flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                addCustomPair();
              }}
              noValidate
            >
              <div>
                <label htmlFor="conv-pair-code" className={labelClass()}>
                  Code
                </label>
                <input
                  id="conv-pair-code"
                  value={newCode}
                  onChange={(event) => setNewCode(event.target.value.toUpperCase())}
                  maxLength={3}
                  placeholder="TZS"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${inputClass} w-28 uppercase tabular-nums`}
                />
              </div>
              <div>
                <label htmlFor="conv-pair-rate" className={labelClass()}>
                  1 unit = ₦
                </label>
                <input
                  id="conv-pair-rate"
                  inputMode="decimal"
                  value={newRate}
                  onChange={(event) => setNewRate(event.target.value)}
                  placeholder="0.00"
                  autoComplete="off"
                  className={`${inputClass} w-40 tabular-nums`}
                />
              </div>
              <button type="submit" className={`px-4 ${secondaryButtonClass} w-auto`}>
                Add pairing
              </button>
              {formError ? (
                <p role="alert" className="w-full text-sm leading-5 text-danger">
                  {formError}
                </p>
              ) : null}
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {customPairs.length === 0 ? (
                <span className="text-sm leading-5 text-muted">No custom pairs yet.</span>
              ) : (
                customPairs.map((pair) => (
                  <span
                    key={pair.code}
                    className="inline-flex items-center gap-2 rounded-input border border-border bg-bg px-2.5 py-1 text-sm tabular-nums"
                  >
                    {pair.code} · ₦{fmt(pair.rate, 2)}
                    <button
                      type="button"
                      onClick={() => removeCustomPair(pair.code)}
                      aria-label={`Remove ${pair.code}`}
                      className={`text-muted hover:text-danger ${focusRing}`}
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
          </SectionCard>
        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-space-lg self-start lg:col-span-4">
          {/* Result */}
          <section
            aria-labelledby="result-h"
            className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm sm:p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="result-h" className="text-sm font-medium uppercase leading-5 tracking-wide text-muted">
                Net export settlement
              </h2>
              <DataSourceBadge badge={rateBadge(rateMap.get(recvCode)) ?? { kind: "live", note: "FX" }} />
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <span
                className={`text-[36px] font-extrabold leading-11 tabular-nums ${
                  metrics.shortfall ? "text-danger" : "text-accent"
                }`}
              >
                {money(metrics.net, recvCode)}
              </span>
              <span className="text-[22px] font-bold text-accent">{recvCode}</span>
            </div>
            <p className="mt-1 text-sm leading-5 text-muted">
              {metrics.shortfall
                ? "Costs exceed the lot — increase the amount or lower the buffer."
                : `Spot ${recvRate ? `₦${fmt(recvRate, 2)}` : "—"} per 1 ${recvCode} · ${bufferPct.toFixed(1)}% buffer + ${exportCostPct.toFixed(1)}% export cost`}
            </p>

            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">Gross equivalent</dt>
                <dd className="font-semibold tabular-nums">{money(metrics.gross, recvCode)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">Handling buffer ({bufferPct.toFixed(1)}%)</dt>
                <dd className="font-semibold text-warning tabular-nums">
                  {signed(metrics.buffer, recvCode)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">Export costs ({exportCostPct.toFixed(1)}%)</dt>
                <dd className="font-semibold text-warning tabular-nums">
                  {signed(metrics.exportCosts, recvCode)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">Destination</dt>
                <dd className="text-right font-semibold text-accent tabular-nums">
                  {selectedAccount ? selectedAccount.label : "Unassigned"}
                </dd>
              </div>
            </dl>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={saveSettlement}
                disabled={!hasChart && recvRate === null}
                className={`px-4 ${primaryButtonClass}`}
              >
                Save settlement
              </button>
              <button
                type="button"
                onClick={downloadSlip}
                disabled={!hasChart || recvRate === null}
                className={`px-4 ${secondaryButtonClass}`}
                title={
                  hasChart
                    ? "Download the parity slip as a text file"
                    : "The slip needs saved rate history — none for this currency yet"
                }
              >
                Download parity slip
              </button>
              <p className="text-sm leading-5 text-muted">
                The slip carries the rate, its provenance, buffer, export cost and the inspected
                chart point. Ledger entries stay on this device.
              </p>
            </div>
          </section>

          {/* Parity index */}
          <SectionCard
            labelledBy="parity-h"
            title="Parity index"
            hint="Same naira valuation in every corridor, net of buffer and export costs. Select a row to settle in it."
          >
            <div className="mt-3 space-y-1">
              {codes
                .filter((code) => code !== "NGN")
                .map((code) => {
                  const rate = rateOf(code);
                  if (!rate || rate <= 0) return null;
                  const m = settlement({
                    amountNgn,
                    recvRate: rate,
                    bufferPct,
                    exportCostPct,
                  });
                  const active = code === recvCode;
                  const meta = metaOf(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      aria-current={active}
                      onClick={() => {
                        setRecvCode(code);
                        writeText(KEY.recv, code);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-input border px-3 py-2 text-left ${focusRing} ${
                        active
                          ? "border-accent bg-accent/10"
                          : "border-transparent hover:border-border hover:bg-bg"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {code}{" "}
                          <span className="font-normal text-muted tabular-nums">
                            · ₦{fmt(rate, 2)}
                          </span>
                        </span>
                        <span className="block truncate text-sm text-muted">{meta.name}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums">
                          {money(m.net, code)}
                        </span>
                        <span className="block text-xs text-muted">net</span>
                      </span>
                    </button>
                  );
                })}
            </div>
          </SectionCard>

          {/* Ledger */}
          <SectionCard
            labelledBy="ledger-h"
            title="Settlement ledger"
            hint="Saved settlements stay on this device only."
            badge={
              <span className="inline-flex items-center rounded-input border border-border bg-surface px-2.5 py-0.5 text-sm font-medium text-muted tabular-nums">
                {ledger.length} saved
              </span>
            }
          >
            {ledger.length === 0 ? (
              <p className="mt-3 text-sm leading-5 text-muted">
                Nothing saved yet. Convert an amount, then save the settlement.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {ledger.map((row, index) => (
                  <li key={`${row.ref}-${row.ts}-${index}`} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums">
                        ₦{fmt(row.ngn, 0)} <span className="font-normal text-muted">→</span>{" "}
                        {money(row.net, row.recv)}{" "}
                        <span className="font-normal text-muted">{row.recv}</span>
                      </p>
                      <p className="truncate text-sm text-muted tabular-nums">
                        {row.account} · {row.buffer.toFixed(1)}% buffer ·{" "}
                        {new Date(row.ts).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLedgerRow(index)}
                      aria-label={`Remove saved settlement ${row.ref}`}
                      className={`shrink-0 text-muted hover:text-danger ${focusRing}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </aside>
      </div>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 bg-surface-container-lowest rounded-xl border border-outline-variant px-4 py-3 text-sm font-semibold shadow-lg lg:bottom-8"
        >
          <span className="tabular-nums">{toast}</span> · <span className="text-muted tabular-nums">{reference}</span>
        </div>
      ) : null}
    </div>
  );
}
