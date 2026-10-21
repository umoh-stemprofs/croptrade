// App-wide configuration.
// Dates "YYYY-MM-DD", times "HH:mm", always in APP_TZ — never the server clock zone (00-global §2).

export const APP_TZ = "Africa/Lagos";

/** Default farm location: Port Harcourt (00-global §3). */
export const DEFAULT_FARM_LAT = 4.8156;
export const DEFAULT_FARM_LON = 7.0498;

/** FX currencies for export (04-croptrade.md). */
export const FX_QUOTES = ["USD", "EUR", "GBP"] as const;
export type FxQuote = (typeof FX_QUOTES)[number];

/** Demo farmer email (password lives in README only — 00-global §3). */
export const DEMO_EMAIL = "farmer@demo.local";

/** A rate older than this is flagged "Old rate" (still calculates). */
export const FX_OLD_RATE_DAYS = 7;
/** Server-side FX cache lifetime. */
export const FX_CACHE_HOURS = 6;
/** Days of live rate history kept for the trend chart (rates are never seeded). */
export const FX_HISTORY_DAYS = 30;
