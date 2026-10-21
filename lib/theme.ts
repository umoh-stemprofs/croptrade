"use client";

// Chart colours for Recharts (client only).
//
// Recharts writes colours as SVG presentation attributes, where `var(--x)` is not
// resolved, so the chart components read the computed CSS variables instead. The
// hook re-reads them whenever the `.dark` class flips, which keeps every line,
// grid and axis legible in both themes without duplicating a palette in JS.

import { useEffect, useState } from "react";

export interface ChartColors {
  grid: string;
  axis: string;
  text: string;
  muted: string;
  surface: string;
  accent: string;
  /** Hover band behind the active bar/point. */
  hover: string;
  /** Colour-blind-safe series colours, light or dark tuned. */
  series: string[];
}

/** Server-render and pre-hydration values (light theme). */
const FALLBACK: ChartColors = {
  grid: "#E2E8F0",
  axis: "#64748B",
  text: "#0F172A",
  muted: "#64748B",
  surface: "#FFFFFF",
  accent: "#008751",
  hover: "rgba(15, 23, 42, 0.04)",
  series: ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#CC79A7", "#56B4E9"],
};

function readVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim();
  return value === "" ? fallback : value;
}

function readColors(): ChartColors {
  if (typeof window === "undefined") return FALLBACK;
  const styles = getComputedStyle(document.documentElement);
  return {
    grid: readVar(styles, "--chart-grid", FALLBACK.grid),
    axis: readVar(styles, "--chart-axis", FALLBACK.axis),
    text: `rgb(${readVar(styles, "--text", "15 23 42")})`,
    muted: `rgb(${readVar(styles, "--muted", "100 116 139")})`,
    surface: `rgb(${readVar(styles, "--surface", "255 255 255")})`,
    accent: `rgb(${readVar(styles, "--accent", "0 135 81")})`,
    hover: document.documentElement.classList.contains("dark")
      ? "rgba(148, 163, 184, 0.12)"
      : "rgba(15, 23, 42, 0.04)",
    series: [1, 2, 3, 4, 5, 6].map((index) =>
      readVar(styles, `--series-${index}`, FALLBACK.series[index - 1])
    ),
  };
}

/**
 * Live chart palette. Re-renders when the theme class changes, so a chart drawn in
 * light mode is redrawn with the dark series colours after the toggle.
 */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    const update = () => setColors(readColors());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
