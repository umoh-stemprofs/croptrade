// Weather orchestration: 30-min cache, live fetch, "Saved data" fallback, error result.

import { describe, expect, it } from "vitest";
import {
  ageLabel,
  getWeather,
  WEATHER_CACHE_MINUTES,
  type WeatherSnapshotRecord,
  type WeatherSnapshotStore,
} from "./getWeather";
import type { WeatherData } from "./types";

const openMeteoFixture = {
  current: {
    time: "2026-10-18T12:00",
    temperature_2m: 30.5,
    relative_humidity_2m: 80,
    weather_code: 2,
    wind_speed_10m: 12,
  },
  daily: {
    time: ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"],
    weather_code: [2, 3, 61, 0, 1],
    temperature_2m_min: [24, 24, 23, 24, 25],
    temperature_2m_max: [31, 30, 29, 32, 33],
    precipitation_sum: [0, 0.4, 12, 0, 0],
    precipitation_probability_max: [10, 20, 80, 5, 10],
  },
};

const okFetch = (() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => openMeteoFixture,
  }) as unknown as Response) as unknown as typeof fetch;

const failingFetch = (() =>
  Promise.reject(new Error("network down"))) as unknown as typeof fetch;

const sampleSnapshotPayload: WeatherData = {
  current: { tempC: 29, humidity: 75, windKmh: 10, text: "Partly cloudy", pressureHpa: 1013 },
  daily: [
    { date: "2026-10-18", minC: 24, maxC: 30, rainMm: 0, rainChancePct: 10 },
    { date: "2026-10-19", minC: 24, maxC: 31, rainMm: 0, rainChancePct: 10 },
    { date: "2026-10-20", minC: 23, maxC: 30, rainMm: 0, rainChancePct: 10 },
    { date: "2026-10-21", minC: 24, maxC: 31, rainMm: 0, rainChancePct: 10 },
    { date: "2026-10-22", minC: 24, maxC: 31, rainMm: 0, rainChancePct: 10 },
  ],
  barometric: [
    { date: "2026-10-18", drop3hMax: 0.3, meanHpa: 1013 },
    { date: "2026-10-19", drop3hMax: 0.5, meanHpa: 1012 },
    { date: "2026-10-20", drop3hMax: 2.4, meanHpa: 1010 },
    { date: "2026-10-21", drop3hMax: 0.2, meanHpa: 1013 },
    { date: "2026-10-22", drop3hMax: 0.1, meanHpa: 1014 },
  ],
  fetchedAt: "2026-10-18T09:00:00.000Z",
  source: "OPEN_METEO",
};

function memoryStore(initial: WeatherSnapshotRecord[] = []): WeatherSnapshotStore & {
  rows: WeatherSnapshotRecord[];
} {
  const rows = [...initial];
  return {
    rows,
    async latest() {
      return rows[0] ?? null;
    },
    async save(_farmId, source, payload) {
      rows.unshift({ fetchedAt: new Date(), source, payload });
    },
  };
}

describe("getWeather", () => {
  it("fetches live, saves a snapshot and shows the Live badge", async () => {
    const store = memoryStore();
    const result = await getWeather("farm-1", 4.8156, 7.0498, {
      store,
      fetchImpl: okFetch,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.badge).toEqual({ kind: "live" });
      expect(result.data.current.tempC).toBe(30.5);
      expect(result.data.current.text).toBe("Partly cloudy");
      expect(result.data.daily).toHaveLength(5);
    }
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0].source).toBe("OPEN_METEO");
  });

  it("returns the last snapshot with the Saved data badge when the call fails", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const store = memoryStore([
      { fetchedAt: threeHoursAgo, source: "OPEN_METEO", payload: sampleSnapshotPayload },
    ]);
    const result = await getWeather("farm-1", 4.8156, 7.0498, {
      store,
      fetchImpl: failingFetch,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.badge).toEqual({ kind: "saved", ageLabel: "3 h old" });
      expect(result.data.current.tempC).toBe(29);
    }
  });

  it("returns a one-sentence error when the call fails and nothing is saved", async () => {
    const result = await getWeather("farm-1", 4.8156, 7.0498, {
      store: memoryStore(),
      fetchImpl: failingFetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unavailable/i);
  });

  it("serves a fresh snapshot from the 30-minute cache without calling the provider", async () => {
    let providerCalls = 0;
    const store = memoryStore([
      {
        fetchedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min old
        source: "OPEN_METEO",
        payload: sampleSnapshotPayload,
      },
    ]);
    const result = await getWeather("farm-1", 4.8156, 7.0498, {
      store,
      provider: async () => {
        providerCalls += 1;
        throw new Error("should not be called");
      },
    });
    expect(providerCalls).toBe(0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.badge.kind).toBe("saved");
  });

  it("rejects bad farm coordinates with one sentence", async () => {
    const result = await getWeather("farm-1", 999, 7.0498, {
      store: memoryStore(),
      fetchImpl: okFetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/latitude/i);
  });

  it("age labels read like the design badge", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    expect(ageLabel(new Date("2026-10-18T11:30:00Z"), now)).toBe("30 min old");
    expect(ageLabel(new Date("2026-10-18T09:00:00Z"), now)).toBe("3 h old");
    expect(ageLabel(new Date("2026-10-16T12:00:00Z"), now)).toBe("2 d old");
  });

  it("cache constant is 30 minutes", () => {
    expect(WEATHER_CACHE_MINUTES).toBe(30);
  });
});
