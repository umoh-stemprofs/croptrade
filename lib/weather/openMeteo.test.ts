// deriveBarometric: turn Open-Meteo's hourly pressure series into each day's
// steepest 3-hour fall and mean pressure. Empty/unusable pressure → honest nulls.

import { describe, expect, it } from "vitest";
import { deriveBarometric } from "./openMeteo";

describe("deriveBarometric", () => {
  it("computes the steepest 3-hour fall and the mean per day", () => {
    // One day, 6 hourly readings: 1015, 1014, 1013, 1010, 1011, 1012.
    // 3-hour falls: (1015→1010)=5, (1014→1011)=3, (1013→1012)=1 → steepest 5.
    const times = [
      "2026-10-23T00:00",
      "2026-10-23T01:00",
      "2026-10-23T02:00",
      "2026-10-23T03:00",
      "2026-10-23T04:00",
      "2026-10-23T05:00",
    ];
    const pressure = [1015, 1014, 1013, 1010, 1011, 1012];
    const result = deriveBarometric(times, pressure, ["2026-10-23"]);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-10-23");
    expect(result[0].drop3hMax).toBe(5);
    expect(result[0].meanHpa).toBeCloseTo(1012.5, 1);
  });

  it("groups readings by the date prefix, not by array position", () => {
    const times = [
      "2026-10-23T00:00",
      "2026-10-23T01:00",
      "2026-10-23T02:00",
      "2026-10-23T03:00",
      "2026-10-24T00:00",
      "2026-10-24T01:00",
      "2026-10-24T02:00",
      "2026-10-24T03:00",
    ];
    // Day 1 falls 1012→1006 (6 hPa/3h); day 2 is steady at 1013.
    const pressure = [1012, 1010, 1008, 1006, 1013, 1013, 1013, 1013];
    const result = deriveBarometric(times, pressure, ["2026-10-23", "2026-10-24"]);
    expect(result).toHaveLength(2);
    expect(result[0].drop3hMax).toBe(6);
    expect(result[1].drop3hMax).toBe(0);
    expect(result[1].meanHpa).toBe(1013);
  });

  it("skips null pressure samples (Open-Meteo can return nulls)", () => {
    const times = [
      "2026-10-23T00:00",
      "2026-10-23T01:00",
      "2026-10-23T02:00",
      "2026-10-23T03:00",
      "2026-10-23T04:00",
    ];
    const pressure = [1012, null, 1010, 1009, 1008];
    const result = deriveBarometric(times, pressure, ["2026-10-23"]);
    // Usable readings are compacted to [1012, 1010, 1009, 1008]; the 3-hour
    // window is points[0] − points[3] = 1012 − 1008 = 4.
    expect(result[0].drop3hMax).toBe(4);
    expect(result[0].meanHpa).toBeCloseTo(1009.75, 1);
  });

  it("returns honest nulls when there are fewer than two usable readings", () => {
    const times = ["2026-10-23T00:00", "2026-10-23T01:00"];
    const pressure = [1012, null];
    const result = deriveBarometric(times, pressure, ["2026-10-23", "2026-10-24"]);
    expect(result[0]).toEqual({ date: "2026-10-23", drop3hMax: null, meanHpa: null });
    // Day 2 has no readings at all.
    expect(result[1]).toEqual({ date: "2026-10-24", drop3hMax: null, meanHpa: null });
  });

  it("computes no 3-hour fall (null) when there are fewer than four readings", () => {
    // 3 readings span only 2 hours — not enough for a 3-hour window, but enough for a mean.
    const times = [
      "2026-10-23T00:00",
      "2026-10-23T01:00",
      "2026-10-23T02:00",
    ];
    const pressure = [1012, 1010, 1008];
    const result = deriveBarometric(times, pressure, ["2026-10-23"]);
    expect(result[0].drop3hMax).toBeNull();
    expect(result[0].meanHpa).toBe(1010);
  });
});
