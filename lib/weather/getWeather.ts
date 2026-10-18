// Weather orchestration (server only, 00-global §3):
// - provider: OpenWeatherMap if OWM_API_KEY is set, otherwise Open-Meteo (no key)
// - 30-minute cache in WeatherSnapshot; on success save a new snapshot
// - if the call fails, return the last snapshot with the "Saved data" badge
// - if there is none, return a one-sentence error the page can show (the rest of the app keeps working)

import { fetchOpenMeteo } from "./openMeteo";
import { fetchOpenWeatherMap } from "./openWeatherMap";
import { weatherDataSchema, type WeatherData, type WeatherProvider } from "./types";

export const WEATHER_CACHE_MINUTES = 30;

export interface WeatherSnapshotRecord {
  fetchedAt: Date;
  source: string;
  payload: unknown;
}

export interface WeatherSnapshotStore {
  latest(farmId: string): Promise<WeatherSnapshotRecord | null>;
  save(farmId: string, source: string, payload: WeatherData): Promise<void>;
}

/** Store that reads and writes nothing. Used when the default location (Port Harcourt)
 *  is shown because the farm lookup failed — there is no farm row to save under. */
export const noOpSnapshotStore: WeatherSnapshotStore = {
  latest: async () => null,
  save: async () => {},
};

export type WeatherBadge =
  | { kind: "live" }
  | { kind: "saved"; ageLabel: string };

export type WeatherResult =
  | { ok: true; data: WeatherData; badge: WeatherBadge }
  | { ok: false; error: string };

/** "30 min old" / "3 h old" / "2 d old" — for the Saved data badge. */
export function ageLabel(fetchedAt: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - fetchedAt.getTime()) / 60_000));
  if (minutes < 60) return `${Math.max(minutes, 1)} min old`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h old`;
  return `${Math.round(hours / 24)} d old`;
}

export function validateCoords(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return "Farm latitude must be between -90 and 90.";
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return "Farm longitude must be between -180 and 180.";
  }
  return null;
}

/** Pick the weather provider from the environment (server only). */
export function makeWeatherProvider(
  fetchImpl?: typeof fetch,
  apiKey: string | undefined = process.env.OWM_API_KEY
): WeatherProvider {
  if (apiKey) {
    return (lat, lon) => fetchOpenWeatherMap(lat, lon, apiKey, fetchImpl);
  }
  return (lat, lon) => fetchOpenMeteo(lat, lon, fetchImpl);
}

function parseSnapshotPayload(record: WeatherSnapshotRecord): WeatherData | null {
  try {
    return weatherDataSchema.parse(record.payload);
  } catch {
    return null;
  }
}

export interface GetWeatherOptions {
  store: WeatherSnapshotStore;
  fetchImpl?: typeof fetch;
  now?: Date;
  provider?: WeatherProvider;
}

export async function getWeather(
  farmId: string,
  lat: number,
  lon: number,
  opts: GetWeatherOptions
): Promise<WeatherResult> {
  const coordError = validateCoords(lat, lon);
  if (coordError) return { ok: false, error: coordError };

  const now = opts.now ?? new Date();

  // 1. Fresh cache (30 min) — served as Saved data.
  try {
    const cached = await opts.store.latest(farmId);
    if (cached) {
      const ageMs = now.getTime() - cached.fetchedAt.getTime();
      const data = parseSnapshotPayload(cached);
      if (data && ageMs >= 0 && ageMs < WEATHER_CACHE_MINUTES * 60_000) {
        return {
          ok: true,
          data: { ...data, fetchedAt: cached.fetchedAt.toISOString() },
          badge: { kind: "saved", ageLabel: ageLabel(cached.fetchedAt, now) },
        };
      }
    }
  } catch {
    // A broken cache must not break the app — go fetch.
  }

  // 2. Fetch fresh (5 s timeout, one retry happen inside fetchJson).
  try {
    const provider = opts.provider ?? makeWeatherProvider(opts.fetchImpl);
    const data = await provider(lat, lon);
    try {
      await opts.store.save(farmId, data.source, data);
    } catch {
      // Failing to write the cache must not break the page.
    }
    return { ok: true, data, badge: { kind: "live" } };
  } catch {
    // 3. Fall back to the last saved snapshot at any age.
    try {
      const last = await opts.store.latest(farmId);
      if (last) {
        const data = parseSnapshotPayload(last);
        if (data) {
          return {
            ok: true,
            data: { ...data, fetchedAt: last.fetchedAt.toISOString() },
            badge: { kind: "saved", ageLabel: ageLabel(last.fetchedAt, now) },
          };
        }
      }
    } catch {
      // Ignore and report the error below.
    }
    return {
      ok: false,
      error: "Weather is unavailable right now. Try again in a few minutes.",
    };
  }
}
