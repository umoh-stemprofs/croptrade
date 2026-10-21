// The market chart's range switcher must slice by the survey timestamps, not by a
// point count. Regression guard: Palm oil has only three reported dates in 90 days,
// and the old slice(-range) showed all three under every range — a 61-day span
// labelled "last 7 days".

import { describe, expect, it } from "vitest";
import { seriesSpanDays, windowSeries } from "./window";

const palmOil = [
  { date: "2026-08-15", priceKobo: 298_100, marketCount: 4 },
  { date: "2026-09-15", priceKobo: 290_000, marketCount: 5 },
  { date: "2026-10-15", priceKobo: 250_000, marketCount: 4 },
];

describe("windowSeries", () => {
  it("drops points older than the range even when the series is sparse", () => {
    const week = windowSeries(palmOil, "2026-10-15", 7);
    expect(week.map((p) => p.date)).toEqual(["2026-10-15"]);
    const month = windowSeries(palmOil, "2026-10-15", 30);
    expect(month.map((p) => p.date)).toEqual(["2026-09-15", "2026-10-15"]);
    const quarter = windowSeries(palmOil, "2026-10-15", 90);
    expect(quarter).toHaveLength(3);
  });

  it("keeps a point exactly at the range boundary and drops one day beyond it", () => {
    const week = windowSeries(
      [{ date: "2026-10-08" }, { date: "2026-10-07" }],
      "2026-10-15",
      7
    );
    expect(week.map((p) => p.date)).toEqual(["2026-10-08"]);
  });

  it("anchors on the crop's own newest record, so a surveyed-earlier crop still charts", () => {
    const garri = [
      { date: "2022-11-15" },
      { date: "2023-01-01" },
      { date: "2023-01-15" },
    ];
    const quarter = windowSeries(garri, "2023-01-15", 90);
    expect(quarter.map((p) => p.date)).toEqual(["2022-11-15", "2023-01-01", "2023-01-15"]);
    const week = windowSeries(garri, "2023-01-15", 7);
    expect(week.map((p) => p.date)).toEqual(["2023-01-15"]);
  });

  it("drops points newer than the anchor and unparseable dates instead of guessing", () => {
    const messy = [
      { date: "2026-10-20" }, // newer than the anchor — not in the window
      { date: "not-a-date" },
      { date: "2026-10-12" },
    ];
    expect(windowSeries(messy, "2026-10-15", 7).map((p) => p.date)).toEqual(["2026-10-12"]);
  });

  it("returns nothing for an empty series", () => {
    expect(windowSeries([], "2026-10-15", 30)).toEqual([]);
  });
});

describe("seriesSpanDays", () => {
  it("measures the span actually shown, not the selected range", () => {
    expect(seriesSpanDays(palmOil)).toBe(61);
  });

  it("is zero when fewer than two points cannot form a trend", () => {
    expect(seriesSpanDays([])).toBe(0);
    expect(seriesSpanDays([{ date: "2026-10-15" }])).toBe(0);
  });
});
