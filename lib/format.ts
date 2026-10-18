// Edge formatting helpers (00-global §2): money formatted as "₦12,500",
// dates "Mon 20 Oct", always in APP_TZ.

import { formatInTimeZone } from "date-fns-tz";
import { APP_TZ } from "./config";

const naira0 = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const naira2 = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Kobo → "₦600". */
export function formatNairaFromKobo(kobo: number): string {
  return naira0.format(kobo / 100);
}

/** Naira number → "₦1,490.71" (used for exchange rates). */
export function formatRate(naira: number): string {
  return naira2.format(naira);
}

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Foreign amount → "$40.00" (stock value in USD). */
export function formatUsd(amount: number): string {
  return usd2.format(amount);
}

const foreign2: Record<string, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
  EUR: new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }),
  GBP: new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }),
};

/** Foreign amount → "$120.50" / "€98.00" / "£85.10" (export value). */
export function formatForeign(amount: number, quote: string): string {
  const formatter = foreign2[quote];
  return formatter ? formatter.format(amount) : `${quote} ${amount.toFixed(2)}`;
}

/** YYYY-MM-DD → "18 Oct 2026" in APP_TZ. */
export function formatDateHuman(iso: string): string {
  return formatInTimeZone(new Date(iso + "T12:00:00Z"), APP_TZ, "d MMM yyyy");
}

/** YYYY-MM-DD → "Wed 22 Oct" in APP_TZ. */
export function formatDateShort(iso: string): string {
  return formatInTimeZone(new Date(iso + "T12:00:00Z"), APP_TZ, "EEE d MMM");
}
