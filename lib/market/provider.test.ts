// MarketProvider adapter: SimulatedProvider is the default; LiveProvider falls back
// to Simulated on failure (00-global §3: "the badge shows the real source").

import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { LiveProvider, SimulatedProvider } from "./provider";

const failingFetch = (() =>
  Promise.reject(new Error("network down"))) as unknown as typeof fetch;

function okFetch(payload: unknown) {
  return (() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => payload,
    }) as unknown as Response) as unknown as typeof fetch;
}

describe("market provider fallback", () => {
  it("falls back to the simulated feed when the live feed fails", async () => {
    const provider = new LiveProvider(
      "https://example.test/prices",
      new SimulatedProvider(),
      failingFetch
    );
    const rows = await provider.latestPrices();
    expect(rows).toHaveLength(CATALOG.length);
    expect(rows.every((r) => r.source === "SIMULATED")).toBe(true);
  });

  it("falls back for history too", async () => {
    const provider = new LiveProvider(
      "https://example.test/prices",
      new SimulatedProvider(),
      failingFetch
    );
    const rows = await provider.history("MAIZE", 7);
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.crop === "MAIZE" && r.source === "SIMULATED")).toBe(true);
  });

  it("uses the live payload when the feed responds with valid data", async () => {
    const payload = [
      {
        crop: "MAIZE",
        date: "2026-10-18",
        priceKobo: 61_000,
        unit: "KG",
        source: "LIVE",
      },
    ];
    const provider = new LiveProvider(
      "https://example.test/prices",
      new SimulatedProvider(),
      okFetch(payload)
    );
    const rows = await provider.latestPrices();
    expect(rows).toEqual(payload);
    expect(rows[0].source).toBe("LIVE");
  });

  it("falls back when the live payload has the wrong shape", async () => {
    const provider = new LiveProvider(
      "https://example.test/prices",
      new SimulatedProvider(),
      okFetch({ unexpected: true })
    );
    const rows = await provider.latestPrices();
    expect(rows.every((r) => r.source === "SIMULATED")).toBe(true);
  });

  it("the simulated provider is the default market source", () => {
    expect(new SimulatedProvider().name).toBe("SIMULATED");
  });
});
