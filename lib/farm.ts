// Farm location resolution (server only, 00-global §3).
// The weather card must keep working when the database is slow or down: if the farm
// lookup fails (or no farm exists yet), fall back to the default coordinates
// (Port Harcourt) so the weather still shows — and the page then skips saving the
// snapshot, because there is no farm row to save it under.

import { DEFAULT_FARM_LAT, DEFAULT_FARM_LON } from "./config";

export interface FarmRow {
  id: string;
  lat: number;
  lon: number;
}

export interface FarmLocation {
  /** null → no usable farm row; use the default location and skip saving snapshots. */
  farmId: string | null;
  lat: number;
  lon: number;
  /** true → showing the default Port Harcourt coordinates (lookup failed, none, or invalid). */
  usedDefault: boolean;
}

/**
 * Resolve the coordinates to show weather for. Never throws: a failed, empty or
 * invalid farm lookup falls back to Port Harcourt (00-global §3 default location).
 */
export async function resolveFarmLocation(
  lookup: () => Promise<FarmRow | null>
): Promise<FarmLocation> {
  try {
    const farm = await lookup();
    if (farm && Number.isFinite(farm.lat) && Number.isFinite(farm.lon)) {
      return { farmId: farm.id, lat: farm.lat, lon: farm.lon, usedDefault: false };
    }
  } catch {
    // Database slow or down — fall through to the default location.
  }
  return { farmId: null, lat: DEFAULT_FARM_LAT, lon: DEFAULT_FARM_LON, usedDefault: true };
}
