// Deterministic price generator (00-global §3 "simulated live feed").
// The same crop + date always yields the same price.
//
// START_DATE 2026-01-01. x[0] = 0. For each day k:
//   x[k] = x[k-1] - 0.03 * x[k-1] + e[k],  e[k] = (rand - 0.5) * 2 * 0.025
//   rand from mulberry32(hash(crop + salt + k))
// Clamp x to ±0.35. Price = round(base * exp(x)).

import { PRICE_START_DATE } from "./catalog";

const CLAMP = 0.35;
const MEAN_REVERT = 0.03;
const NOISE = 0.025;

/** FNV-1a 32-bit string hash. */
export function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whole days since PRICE_START_DATE for a "YYYY-MM-DD" date (UTC-safe, date only). */
export function dayIndex(dateIso: string): number {
  const start = Date.parse(PRICE_START_DATE + "T00:00:00Z");
  const day = Date.parse(dateIso + "T00:00:00Z");
  if (Number.isNaN(start) || Number.isNaN(day)) {
    throw new Error(`Invalid date "${dateIso}" — expected YYYY-MM-DD.`);
  }
  return Math.round((day - start) / 86_400_000);
}

function clampX(x: number): number {
  return Math.max(-CLAMP, Math.min(CLAMP, x));
}

/**
 * Price in whole naira for a crop on a given date (YYYY-MM-DD).
 * Deterministic: same inputs always give the same output.
 * Throws if the date is before the generator start date.
 */
export function priceNaira(
  crop: string,
  salt: string,
  base: number,
  dateIso: string
): number {
  const k = dayIndex(dateIso);
  if (k < 0) throw new Error(`Date ${dateIso} is before ${PRICE_START_DATE}.`);
  let x = 0;
  for (let day = 1; day <= k; day++) {
    const rand = mulberry32(hash32(crop + salt + day))();
    const e = (rand - 0.5) * 2 * NOISE;
    x = clampX(x - MEAN_REVERT * x + e);
  }
  return Math.round(base * Math.exp(x));
}

/** Price in kobo for a crop on a given date. */
export function priceKobo(
  crop: string,
  salt: string,
  base: number,
  dateIso: string
): number {
  return priceNaira(crop, salt, base, dateIso) * 100;
}
