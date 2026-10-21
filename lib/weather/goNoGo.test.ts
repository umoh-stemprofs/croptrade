// Dispatch flags: lock conditions, middle band, dry GO, and honest handling of
// missing barometric data.

import { describe, expect, it } from "vitest";
import {
  DISPATCH_THRESHOLDS,
  dispatchMatrix,
  dispatchStatusFor,
  type DayBarometric,
} from "./goNoGo";
import type { WeatherDay } from "./types";

function day(overrides: Partial<WeatherDay> = {}): WeatherDay {
  return {
    date: "2026-10-23",
    minC: 23,
    maxC: 32,
    rainMm: 0,
    rainChancePct: 10,
    ...overrides,
  };
}

function baro(overrides: Partial<DayBarometric> = {}): DayBarometric {
  return { date: "2026-10-23", drop3hMax: 0.4, meanHpa: 1012, ...overrides };
}

describe("dispatchStatusFor", () => {
  it("flags GO for a dry day with a stable barometer", () => {
    const status = dispatchStatusFor(day(), baro());
    expect(status.flag).toBe("GO");
    expect(status.reason).toContain("pressure");
    expect(status.pressureUnknown).toBe(false);
  });

  it("applies the 4.5 hPa/3h barometric lock as NO-GO regardless of rain", () => {
    const status = dispatchStatusFor(
      day({ rainMm: 0, rainChancePct: 5 }),
      baro({ drop3hMax: DISPATCH_THRESHOLDS.lockDropHpa + 0.1 })
    );
    expect(status.flag).toBe("NO-GO");
    expect(status.reason).toContain("Barometric lock");
  });

  it("flags NO-GO when rainfall breaks the 15 mm heavy-rain threshold", () => {
    const status = dispatchStatusFor(
      day({ rainMm: 22.4, rainChancePct: 60 }),
      baro()
    );
    expect(status.flag).toBe("NO-GO");
    expect(status.reason).toContain("22.4 mm");
  });

  it("flags NO-GO for an 80%+ rain chance", () => {
    const status = dispatchStatusFor(day({ rainMm: 3, rainChancePct: 88 }), baro());
    expect(status.flag).toBe("NO-GO");
  });

  it("flags NO-GO when the dry-loading rule (5 mm) is broken", () => {
    const status = dispatchStatusFor(day({ rainMm: 6, rainChancePct: 40 }), baro());
    expect(status.flag).toBe("NO-GO");
    expect(status.reason).toContain("dry-loading rule");
  });

  it("flags CAUTION between the bands", () => {
    const status = dispatchStatusFor(day({ rainMm: 2, rainChancePct: 55 }), baro());
    expect(status.flag).toBe("CAUTION");
    const falling = dispatchStatusFor(
      day({ rainMm: 0, rainChancePct: 10 }),
      baro({ drop3hMax: 3 })
    );
    expect(falling.flag).toBe("CAUTION");
    expect(falling.reason).toContain("pressure fell 3 hPa/3h");
  });

  it("still decides from rainfall when pressure data is missing, and says so", () => {
    const wet = dispatchStatusFor(day({ rainMm: 20, rainChancePct: 70 }), null);
    expect(wet.flag).toBe("NO-GO");
    expect(wet.pressureUnknown).toBe(true);
    expect(wet.reason).toContain("pressure trend unavailable");

    const dry = dispatchStatusFor(day(), null);
    expect(dry.flag).toBe("GO");
    expect(dry.pressureUnknown).toBe(true);
    expect(dry.reason).toContain("pressure unknown");
  });
});

describe("dispatchMatrix", () => {
  it("aligns pressure entries by date and leaves unmatched days unknown", () => {
    const days = [day({ date: "2026-10-23" }), day({ date: "2026-10-24", rainMm: 18 })];
    const matrix = dispatchMatrix(days, [baro({ date: "2026-10-23" })]);
    expect(matrix[0].flag).toBe("GO");
    expect(matrix[0].pressureUnknown).toBe(false);
    expect(matrix[1].flag).toBe("NO-GO");
    expect(matrix[1].pressureUnknown).toBe(true);
  });
});
