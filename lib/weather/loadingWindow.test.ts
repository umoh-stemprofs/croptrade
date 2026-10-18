// Loading window (04-croptrade.md): first of the next 5 forecast days with rain < 5 mm.
// 2026-10-18 is a Sunday, so 2026-10-21 is a Wednesday.

import { describe, expect, it } from "vitest";
import { loadingWindow } from "./loadingWindow";
import type { WeatherDay } from "./types";

const day = (date: string, rainMm: number): WeatherDay => ({
  date,
  minC: 24,
  maxC: 31,
  rainMm,
  rainChancePct: rainMm > 0 ? 80 : 10,
});

describe("loading window", () => {
  it("picks the first of the next 5 days with rain under 5 mm", () => {
    const daily = [
      day("2026-10-18", 12),
      day("2026-10-19", 6.5),
      day("2026-10-21", 0), // Wednesday
      day("2026-10-22", 0),
      day("2026-10-23", 30),
    ];
    const result = loadingWindow(daily);
    expect(result).toEqual({
      ok: true,
      date: "2026-10-21",
      message: "Best day to load: Wed 21 Oct.",
    });
  });

  it("rain of exactly 5 mm does not count as dry", () => {
    const daily = [day("2026-10-18", 8), day("2026-10-19", 5), day("2026-10-21", 0)];
    const result = loadingWindow(daily);
    expect(result.date).toBe("2026-10-21");
  });

  it("says the covered-loading message when rain is in all 5 days", () => {
    const daily = [
      day("2026-10-18", 9),
      day("2026-10-19", 5.5),
      day("2026-10-20", 20),
      day("2026-10-21", 7),
      day("2026-10-22", 12),
    ];
    const result = loadingWindow(daily);
    expect(result).toEqual({
      ok: false,
      date: null,
      message: "Rain all week. Plan covered loading.",
    });
  });

  it("only looks at the first 5 forecast days", () => {
    const daily = [
      day("2026-10-18", 9),
      day("2026-10-19", 9),
      day("2026-10-20", 9),
      day("2026-10-21", 9),
      day("2026-10-22", 9),
      day("2026-10-23", 0), // day 6 — must not be picked
    ];
    expect(loadingWindow(daily).ok).toBe(false);
  });

  it("handles an empty forecast without crashing", () => {
    expect(loadingWindow([]).message).toBe("Rain all week. Plan covered loading.");
  });
});
