// Weather must keep working when the database is slow or down (00-global §3):
// a failed farm lookup falls back to the default coordinates (Port Harcourt),
// the weather still shows, and no snapshot is saved.

import { describe, expect, it } from "vitest";
import { resolveFarmLocation } from "./farm";
import { DEFAULT_FARM_LAT, DEFAULT_FARM_LON } from "./config";
import { getWeather, noOpSnapshotStore } from "./weather/getWeather";
import type { WeatherData } from "./weather/types";

describe("resolveFarmLocation", () => {
  it("uses the farm's own coordinates when the lookup works", async () => {
    const location = await resolveFarmLocation(async () => ({
      id: "farm-1",
      lat: 5.1,
      lon: 6.2,
    }));
    expect(location).toEqual({ farmId: "farm-1", lat: 5.1, lon: 6.2, usedDefault: false });
  });

  it("falls back to Port Harcourt when the lookup fails (database down)", async () => {
    const location = await resolveFarmLocation(async () => {
      throw new Error("P1001: Can't reach database server");
    });
    expect(location.usedDefault).toBe(true);
    expect(location.farmId).toBeNull();
    expect(location.lat).toBe(DEFAULT_FARM_LAT);
    expect(location.lon).toBe(DEFAULT_FARM_LON);
  });

  it("falls back to Port Harcourt when there is no farm row", async () => {
    const location = await resolveFarmLocation(async () => null);
    expect(location.usedDefault).toBe(true);
    expect(location.lat).toBe(DEFAULT_FARM_LAT);
    expect(location.lon).toBe(DEFAULT_FARM_LON);
  });
});

const fixture: WeatherData = {
  current: { tempC: 30.5, humidity: 78, windKmh: 9, text: "Partly cloudy" },
  daily: [
    { date: "2026-10-18", minC: 24, maxC: 31, rainMm: 2, rainChancePct: 20 },
    { date: "2026-10-19", minC: 24, maxC: 30, rainMm: 12, rainChancePct: 70 },
  ],
  fetchedAt: "2026-10-18T12:00:00Z",
  source: "OPEN_METEO",
};

describe("weather with the default location (database down)", () => {
  it("still returns live weather through the no-op store", async () => {
    const location = await resolveFarmLocation(async () => {
      throw new Error("P1001: Can't reach database server");
    });
    const result = await getWeather(
      location.farmId ?? "default-location",
      location.lat,
      location.lon,
      { store: noOpSnapshotStore, provider: async () => fixture }
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.badge).toEqual({ kind: "live" });
      expect(result.data.current.tempC).toBe(30.5);
      expect(result.data.daily).toHaveLength(2);
    }
  });

  it("the no-op snapshot store reads nothing and writes nothing", async () => {
    expect(await noOpSnapshotStore.latest("any-farm")).toBeNull();
    await expect(
      noOpSnapshotStore.save("any-farm", "OPEN_METEO", fixture)
    ).resolves.toBeUndefined();
  });
});
