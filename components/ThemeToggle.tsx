"use client";

// Theme toggle in the exact shape of the Stitch header button:
// a 56×56 rounded-xl ghost button with Material Symbols light/dark icons.

import { useEffect, useState } from "react";

const focusRing =
  "focus:outline-none focus:bg-surface-container-highest";

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    try {
      localStorage.setItem("croptrade-theme", next ? "dark" : "light");
    } catch {
      /* storage blocked — the OS preference still applies on next load */
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      aria-pressed={dark === true}
      className={`min-h-[56px] min-w-[56px] rounded-xl flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors ${focusRing}`}
    >
      <span
        className={`material-symbols-outlined text-[24px] ${dark ? "hidden" : ""}`}
        aria-hidden="true"
      >
        light_mode
      </span>
      <span
        className={`material-symbols-outlined text-[24px] ${dark ? "" : "hidden"}`}
        aria-hidden="true"
      >
        dark_mode
      </span>
    </button>
  );
}
