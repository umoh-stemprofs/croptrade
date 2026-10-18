// App-wide configuration.
// Dates "YYYY-MM-DD", times "HH:mm", always in APP_TZ — never the server clock zone (00-global §2).

export const APP_TZ = "Africa/Lagos";

/** Default farm location: Port Harcourt (00-global §3). */
export const DEFAULT_FARM_LAT = 4.8156;
export const DEFAULT_FARM_LON = 7.0498;

/** Sample thresholds (PLACEHOLDERS — expert review before real use). Weather adapter arrives in step 2. */
export const WEATHER_ALERTS = {
  heatMaxC: 34,
  heavyRainMm: 20, // in the next 3 days
  dampHumidityPct: 80,
} as const;

/** FX currencies for export (04-croptrade.md). */
export const FX_QUOTES = ["USD", "EUR", "GBP"] as const;
export type FxQuote = (typeof FX_QUOTES)[number];

/** Demo farmer email (password lives in README only — 00-global §3). */
export const DEMO_EMAIL = "farmer@demo.local";

/** A rate older than this is flagged "Old rate" (still calculates). */
export const FX_OLD_RATE_DAYS = 7;
/** Server-side FX cache lifetime. */
export const FX_CACHE_HOURS = 6;
/** SIMULATED history seeded on first run so the trend chart has data. */
export const FX_HISTORY_DAYS = 30;
