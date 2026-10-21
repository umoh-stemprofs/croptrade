// Live Nigerian staple prices from the World Food Programme (WFP) via HDX, with
// FEWS NET as a second live source. Every record here comes off the network: no
// fallback arrays, no seeded prices. If both sources fail, the caller gets a
// MarketFeedError and the UI shows an error state with a retry.
//
// Source notes (checked 2026-10-20):
//   • HDX's visualisation API reports datastore_active: false for this resource, so
//     datastore_search answers 404 "resource not found". The resource's CSV is live
//     (latest prices 2026-10-15), so CSV is the primary path and the datastore call
//     is attempted first in case HDX re-enables it.
//   • Fetch the file path that names the CSV. The bare "…/download" URL answers 302
//     to a signed S3 URL that HDX's bot filter blocks for non-browser agents; the
//     named file is served directly and works from a server.
//   • FEWS NET marketpricefacts answers for country_code=NG; it is the fallback and
//     is paged through only as far as needed.

import { CATALOG, type CatalogEntry, type PriceUnitKey, getCatalogEntry } from "./catalog";

export const HDX_RESOURCE_ID = "12b51155-0cd3-4806-9924-61ede4077591";
export const HDX_DATASTORE_URL = "https://data.humdata.org/api/3/action/datastore_search";
export const HDX_CSV_URL = `https://data.humdata.org/dataset/wfp-food-prices-for-nigeria/resource/${HDX_RESOURCE_ID}/download/wfp_food_prices_nga.csv`;
export const FEWS_NET_URL = "https://fdw.fews.net/api/marketpricefacts/";

/**
 * How far back we keep observations. Wider than the 90-day charts need: WFP stopped
 * surveying maize and garri in 2023, and showing their last recorded price (clearly
 * dated) beats pretending the crop has no data at all.
 */
const KEEP_DAYS = 1500;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;

export type LiveSource = "HDX_CSV" | "HDX_DATASTORE" | "FEWS_NET";
export type PriceType = "Retail" | "Wholesale";

export interface LiveObservation {
  crop: string;
  /** Commodity name exactly as the source spells it. */
  commodity: string;
  market: string;
  state: string;
  /** YYYY-MM-DD (observation date). */
  date: string;
  /** Price of one catalog unit (kg or litre), in kobo. */
  priceKobo: number;
  unit: PriceUnitKey;
  priceType: PriceType;
  /** WFP priceflag: true when the survey measured the price (not an aggregate). */
  actual: boolean;
  source: LiveSource;
}

export interface CropQuote {
  crop: string;
  label: string;
  unit: PriceUnitKey;
  /** Newest observation date for this crop (YYYY-MM-DD). */
  date: string;
  /** Median across markets on that date, in kobo per unit. */
  priceKobo: number;
  minKobo: number;
  maxKobo: number;
  /** Median on the previous observation date, or null when there is none. */
  previousKobo: number | null;
  marketCount: number;
  stateCount: number;
  markets: string[];
  states: string[];
  priceType: PriceType;
  source: LiveSource;
}

export interface MarketFeed {
  quotes: CropQuote[];
  observations: LiveObservation[];
  /** Newest observation date across all crops (YYYY-MM-DD). */
  asOf: string;
  sources: LiveSource[];
  fetchedAt: number;
}

export class MarketFeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketFeedError";
  }
}

// ---------------------------------------------------------------- commodity map

const ALIAS_TO_CROP = new Map<string, string>();
for (const entry of CATALOG) {
  for (const alias of entry.aliases) {
    ALIAS_TO_CROP.set(alias.trim().toLowerCase(), entry.crop);
  }
}

/** WFP/FEWS commodity string → catalog crop key, or null when we do not track it. */
export function cropForCommodity(name: string): string | null {
  return ALIAS_TO_CROP.get(name.trim().toLowerCase()) ?? null;
}

// ------------------------------------------------------------------ unit maths

const UNIT_PATTERN = /^(\d+(?:\.\d+)?)?[\s_]*([a-z]+)$/i;

/**
 * Turn a source unit ("kg", "100 kg", "50_kg", "g", "L", "30_L", "ml") into the
 * quantity it covers in kg or litres. Returns null for anything not a weight or
 * volume (e.g. "30 pcs", "100 tubers"), which we do not turn into a per-kg price.
 */
export function normalizeUnit(raw: string): { size: number; unit: PriceUnitKey } | null {
  const match = raw.trim().match(UNIT_PATTERN);
  if (!match) return null;
  const size = match[1] ? Number(match[1]) : 1;
  if (!Number.isFinite(size) || size <= 0) return null;
  const kind = match[2].toLowerCase();
  if (kind === "kg") return { size, unit: "KG" };
  if (kind === "g") return { size: size / 1000, unit: "KG" };
  if (kind === "l" || kind === "lt" || kind === "ltr" || kind === "litre" || kind === "liter") {
    return { size, unit: "LITRE" };
  }
  if (kind === "ml") return { size: size / 1000, unit: "LITRE" };
  return null;
}

/**
 * Price of a pack (e.g. ₦12,000 per 50 kg) → kobo per kg/litre. Returns null when
 * the unit is unparseable or does not match the crop's catalog unit.
 */
export function pricePerUnitKobo(
  price: number,
  rawUnit: string,
  expected: PriceUnitKey
): number | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const normalized = normalizeUnit(rawUnit);
  if (!normalized || normalized.unit !== expected) return null;
  return Math.round((price / normalized.size) * 100);
}

// ------------------------------------------------------------------- CSV parse

/** RFC 4180-ish parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function headerIndex(header: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  header.forEach((name, i) => {
    index[name.trim().toLowerCase()] = i;
  });
  return index;
}

function pick(row: string[], index: Record<string, number>, ...names: string[]): string {
  for (const name of names) {
    const at = index[name];
    if (at !== undefined) {
      const value = row[at];
      if (value !== undefined && value !== "") return value.trim();
    }
  }
  return "";
}

export function isoDaysAgo(days: number, today = new Date()): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoDate(raw: string): string | null {
  const value = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Map WFP Nigeria CSV rows to observations. Rows we cannot read are skipped. */
export function observationsFromWfpCsv(
  csvText: string,
  sinceIso: string,
  source: LiveSource = "HDX_CSV"
): LiveObservation[] {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];
  const header = headerIndex(rows[0]);
  const out: LiveObservation[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    const currency = pick(row, header, "currency", "currency_code");
    if (currency && currency.toUpperCase() !== "NGN") continue;
    const date = isoDate(pick(row, header, "date", "period_date"));
    if (!date || date < sinceIso) continue;
    const commodity = pick(row, header, "commodity", "commodity_name");
    const crop = cropForCommodity(commodity);
    if (!crop) continue;
    const entry = getCatalogEntry(crop);
    if (!entry) continue;
    const price = Number(pick(row, header, "price", "value"));
    const rawUnit = pick(row, header, "unit", "unit_name");
    const priceKobo = pricePerUnitKobo(price, rawUnit, entry.unit);
    if (priceKobo === null) continue;
    const market = pick(row, header, "market", "market_name");
    const state = pick(row, header, "admin1", "state", "admin_1");
    const priceType = pick(row, header, "pricetype", "price_type").toLowerCase() === "wholesale"
      ? "Wholesale"
      : "Retail";
    // "actual" is a measured price; "aggregate" is WFP's computed average for the
    // market, which we only keep when no measured value exists.
    const actual = pick(row, header, "priceflag", "price_flag").toLowerCase().includes("actual");
    out.push({
      crop,
      commodity,
      market: market || "Unknown market",
      state: state || "Unknown state",
      date,
      priceKobo,
      unit: entry.unit,
      priceType,
      actual,
      source,
    });
  }
  return out;
}

/** Map a resource record from datastore_search (JSON) to observations. */
export function observationsFromRecords(
  records: Record<string, unknown>[],
  sinceIso: string
): LiveObservation[] {
  const out: LiveObservation[] = [];
  for (const record of records) {
    const get = (...names: string[]): string => {
      for (const name of names) {
        const value = record[name];
        if (value !== undefined && value !== null && value !== "") return String(value).trim();
      }
      return "";
    };
    const currency = get("currency");
    if (currency && currency.toUpperCase() !== "NGN") continue;
    const date = isoDate(get("date", "period_date"));
    if (!date || date < sinceIso) continue;
    const commodity = get("commodity", "commodity_name");
    const crop = cropForCommodity(commodity);
    if (!crop) continue;
    const entry = getCatalogEntry(crop);
    if (!entry) continue;
    const priceKobo = pricePerUnitKobo(Number(get("price", "value")), get("unit", "unit_name"), entry.unit);
    if (priceKobo === null) continue;
    out.push({
      crop,
      commodity,
      market: get("market", "market_name") || "Unknown market",
      state: get("admin1", "state", "admin_1") || "Unknown state",
      date,
      priceKobo,
      unit: entry.unit,
      priceType: get("pricetype", "price_type").toLowerCase() === "wholesale" ? "Wholesale" : "Retail",
      actual: !get("priceflag", "price_flag").toLowerCase().includes("aggregate"),
      source: "HDX_DATASTORE",
    });
  }
  return out;
}

/** Map FEWS NET marketpricefacts records to observations. */
export function observationsFromFews(
  records: Record<string, unknown>[],
  sinceIso: string
): LiveObservation[] {
  const out: LiveObservation[] = [];
  for (const record of records) {
    const get = (...names: string[]): string => {
      for (const name of names) {
        const value = record[name];
        if (value !== undefined && value !== null && value !== "") return String(value).trim();
      }
      return "";
    };
    const date = isoDate(get("period_date", "date", "start_date"));
    if (!date || date < sinceIso) continue;
    const commodity = get("product", "product_name", "commodity");
    const crop = cropForCommodity(commodity);
    if (!crop) continue;
    const entry = getCatalogEntry(crop);
    if (!entry) continue;
    const priceKobo = pricePerUnitKobo(Number(get("value", "price")), get("unit", "unit_name"), entry.unit);
    if (priceKobo === null) continue;
    out.push({
      crop,
      commodity,
      market: get("market", "market_name") || "Unknown market",
      state: get("state", "admin1", "admin_1") || "Unknown state",
      date,
      priceKobo,
      unit: entry.unit,
      priceType: get("price_type", "pricetype").toLowerCase() === "wholesale" ? "Wholesale" : "Retail",
      actual: true,
      source: "FEWS_NET",
    });
  }
  return out;
}

// ----------------------------------------------------------------- aggregation

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function groupByDate(rows: LiveObservation[]): Map<string, LiveObservation[]> {
  const byDate = new Map<string, LiveObservation[]>();
  for (const row of rows) {
    const bucket = byDate.get(row.date);
    if (bucket) bucket.push(row);
    else byDate.set(row.date, [row]);
  }
  return byDate;
}

/**
 * One record per market for a date: measured prices win over aggregates, and retail
 * wins over wholesale when a market reports both. Counting a market twice would let
 * one state dominate the median.
 */
function selectForDate(rows: LiveObservation[]): {
  use: LiveObservation[];
  priceType: PriceType;
  markets: string[];
  states: string[];
} | null {
  if (rows.length === 0) return null;
  const best = new Map<string, LiveObservation>();
  for (const row of rows) {
    const key = `${row.market}|${row.priceType}`;
    const previous = best.get(key);
    if (!previous || (row.actual && !previous.actual)) best.set(key, row);
  }
  const unique = [...best.values()];
  const retail = unique.filter((row) => row.priceType === "Retail");
  const use = retail.length > 0 ? retail : unique;
  return {
    use,
    priceType: use[0].priceType,
    markets: [...new Set(use.map((row) => row.market))].sort(),
    states: [...new Set(use.map((row) => row.state))].sort(),
  };
}

/** Median price for one date, preferring retail and measured quotes. */
function medianForDate(
  rows: LiveObservation[]
): { kobo: number; priceType: PriceType; marketCount: number } | null {
  const selected = selectForDate(rows);
  if (!selected) return null;
  return {
    kobo: median(selected.use.map((row) => row.priceKobo)),
    priceType: selected.priceType,
    marketCount: selected.markets.length,
  };
}

/** Newest quote per catalog crop, aggregated across markets. */
export function latestQuotes(observations: LiveObservation[]): CropQuote[] {
  const quotes: CropQuote[] = [];
  for (const entry of CATALOG) {
    const rows = observations.filter((o) => o.crop === entry.crop);
    if (rows.length === 0) continue;
    const dates = [...new Set(rows.map((r) => r.date))].sort();
    const date = dates[dates.length - 1];
    const today = rows.filter((r) => r.date === date);
    const current = medianForDate(today);
    if (!current) continue;
    const selected = selectForDate(today)!;
    const previousDate = dates[dates.length - 2];
    const previous = previousDate
      ? medianForDate(rows.filter((r) => r.date === previousDate))
      : null;
    const prices = selected.use.map((r) => r.priceKobo);
    quotes.push({
      crop: entry.crop,
      label: entry.label,
      unit: entry.unit,
      date,
      priceKobo: current.kobo,
      minKobo: Math.min(...prices),
      maxKobo: Math.max(...prices),
      previousKobo: previous ? previous.kobo : null,
      marketCount: selected.markets.length,
      stateCount: selected.states.length,
      markets: selected.markets,
      states: selected.states,
      priceType: current.priceType,
      source: selected.use[0].source,
    });
  }
  return quotes.sort((a, b) => b.priceKobo - a.priceKobo);
}

/**
 * Median price per observation date for one crop, inside the last `days` days
 * ending at `anchorIso` (the feed's newest date — it lags the wall clock).
 */
export function seriesFor(
  observations: LiveObservation[],
  crop: string,
  days: number,
  anchorIso = isoDaysAgo(0)
): { date: string; priceKobo: number; marketCount: number }[] {
  const start = isoDaysAgo(days - 1, new Date(`${anchorIso}T00:00:00Z`));
  const rows = observations.filter((o) => o.crop === crop && o.date >= start && o.date <= anchorIso);
  const byDate = groupByDate(rows);
  return [...byDate.keys()]
    .sort()
    .map((date) => {
      const value = medianForDate(byDate.get(date)!);
      return value ? { date, priceKobo: value.kobo, marketCount: value.marketCount } : null;
    })
    .filter(
      (point): point is { date: string; priceKobo: number; marketCount: number } => point !== null
    );
}

export function buildFeed(observations: LiveObservation[]): MarketFeed {
  const quotes = latestQuotes(observations);
  const asOf = observations.reduce((max, o) => (o.date > max ? o.date : max), "");
  return {
    quotes,
    observations,
    asOf,
    sources: [...new Set(observations.map((o) => o.source))],
    fetchedAt: Date.now(),
  };
}

// --------------------------------------------------------------------- network

async function fetchWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "text/csv,application/json;q=0.9,*/*;q=0.8" },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fromHdxDatastore(sinceIso: string): Promise<LiveObservation[]> {
  const params = new URLSearchParams({
    resource_id: HDX_RESOURCE_ID,
    limit: "32000",
    filters: JSON.stringify({ currency: "NGN" }),
  });
  const response = await fetchWithTimeout(`${HDX_DATASTORE_URL}?${params.toString()}`, 8_000);
  if (!response.ok) throw new Error(`HDX datastore returned ${response.status}`);
  const body = (await response.json()) as {
    success?: boolean;
    result?: { records?: Record<string, unknown>[] };
  };
  const records = body?.result?.records;
  if (!body?.success || !Array.isArray(records)) throw new Error("HDX datastore payload was not usable");
  return observationsFromRecords(records, sinceIso);
}

async function fromHdxCsv(sinceIso: string): Promise<LiveObservation[]> {
  const response = await fetchWithTimeout(HDX_CSV_URL, 60_000);
  if (!response.ok) throw new Error(`HDX download returned ${response.status}`);
  const csv = await response.text();
  if (!csv.includes("commodity")) throw new Error("HDX download did not look like the price CSV");
  return observationsFromWfpCsv(csv, sinceIso, "HDX_CSV");
}

async function fromFewsNet(sinceIso: string): Promise<LiveObservation[]> {
  const params = new URLSearchParams({
    country_code: "NG",
    start_date: sinceIso,
    format: "json",
    page_size: "500",
  });
  const response = await fetchWithTimeout(`${FEWS_NET_URL}?${params.toString()}`, 30_000);
  if (!response.ok) throw new Error(`FEWS NET returned ${response.status}`);
  const body = await response.json();
  const records: Record<string, unknown>[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.results)
      ? body.results
      : Array.isArray(body?.data)
        ? body.data
        : [];
  if (records.length === 0) throw new Error("FEWS NET returned no price records");
  return observationsFromFews(records, sinceIso);
}

const SOURCE_ORDER: { label: string; load: (sinceIso: string) => Promise<LiveObservation[]> }[] = [
  { label: "HDX datastore", load: fromHdxDatastore },
  { label: "HDX CSV", load: fromHdxCsv },
  { label: "FEWS NET", load: fromFewsNet },
];

// ---------------------------------------------------------------------- cache

let cache: { at: number; feed: MarketFeed } | null = null;
let inflight: Promise<MarketFeed> | null = null;

async function fetchFeed(): Promise<MarketFeed> {
  const sinceIso = isoDaysAgo(KEEP_DAYS);
  const problems: string[] = [];

  for (const source of SOURCE_ORDER) {
    try {
      const observations = await source.load(sinceIso);
      if (observations.length === 0) {
        problems.push(`${source.label}: no matching Nigerian price rows`);
        continue;
      }
      return buildFeed(observations);
    } catch (error) {
      problems.push(`${source.label}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  throw new MarketFeedError(
    `Live market prices are unavailable right now. ${problems.join("; ")}. Try again in a moment.`
  );
}

/**
 * The live market feed, cached for 6 hours. `force` skips the cache (the "Try Again"
 * button) and shares any request already in flight.
 */
export async function loadMarketFeed(options?: { force?: boolean }): Promise<MarketFeed> {
  const fresh = cache && Date.now() - cache.at < CACHE_TTL_MS;
  if (fresh && !options?.force) return cache!.feed;
  if (inflight) return inflight;
  inflight = fetchFeed()
    .then((feed) => {
      cache = { at: Date.now(), feed };
      return feed;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function catalogEntryFor(crop: string): CatalogEntry | undefined {
  return getCatalogEntry(crop);
}
