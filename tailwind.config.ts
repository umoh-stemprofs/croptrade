import type { Config } from "tailwindcss";

// AgroExecutive Tactical Canvas tokens (agroexecutive_tactical_canvas/DESIGN.md).
// Every colour is a CSS variable so `dark:` needs no per-component work — the
// `.dark` class on <html> swaps the variables in app/globals.css.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        border: token("border"),
        text: token("text"),
        muted: token("muted"),
        accent: {
          DEFAULT: token("accent"),
          hover: token("accent-hover"),
          fg: token("accent-fg"),
        },
        primary: token("accent"),
        secondary: token("info"),
        success: { DEFAULT: token("success"), bg: token("success-bg") },
        warning: { DEFAULT: token("warning"), bg: token("warning-bg") },
        danger: { DEFAULT: token("danger"), bg: token("danger-bg") },
        info: { DEFAULT: token("info"), bg: token("info-bg") },
        amber: token("amber"),
        "on-surface": token("text"),
        "on-surface-variant": token("muted"),
        outline: token("muted"),
        "outline-variant": token("border"),
      },
      fontSize: {
        // DESIGN.md type scale: Plus Jakarta Sans for display/headline, Inter below.
        // The token carries weight + tracking so one class is the whole style.
        "display-lg": [
          "36px",
          { lineHeight: "44px", letterSpacing: "-0.025em", fontWeight: "800" },
        ],
        "display-lg-mobile": [
          "28px",
          { lineHeight: "36px", letterSpacing: "-0.02em", fontWeight: "800" },
        ],
        "headline-lg": [
          "30px",
          { lineHeight: "38px", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        "headline-md": [
          "22px",
          { lineHeight: "28px", letterSpacing: "-0.015em", fontWeight: "600" },
        ],
        "headline-sm": [
          "18px",
          { lineHeight: "24px", letterSpacing: "-0.01em", fontWeight: "600" },
        ],
        "title-md": [
          "16px",
          { lineHeight: "22px", letterSpacing: "-0.005em", fontWeight: "600" },
        ],
        "label-sm": [
          "11px",
          { lineHeight: "14px", letterSpacing: "0.04em", fontWeight: "600" },
        ],
        "data-mono": [
          "14px",
          { lineHeight: "20px", letterSpacing: "-0.01em", fontWeight: "600" },
        ],
      },
      borderRadius: {
        // Level 1 (Soft): 4px controls, 8px cards, 12px overlays.
        input: "4px",
        card: "8px",
        dialog: "12px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(var(--shadow) / .05), 0 1px 2px -1px rgb(var(--shadow) / .04)",
        dialog: "0 12px 24px -4px rgb(var(--shadow) / .16)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Plus Jakarta Sans", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
