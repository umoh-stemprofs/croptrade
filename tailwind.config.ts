import type { Config } from "tailwindcss";

// Google Stitch design system — the exact token vocabulary used by every page
// in stitch_croptrade_enterprise_analytics_cockpit/ (Material-3 colour roles,
// the prototype spacing/type scale, compact 4/8/12px radii). Every colour
// resolves to a CSS variable defined in app/globals.css, so the `.dark` class
// swaps the whole palette with no per-component work.
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
        // Material-3 surface roles (verbatim from the Stitch config).
        surface: token("surface"),
        "surface-dim": token("surface-dim"),
        "surface-bright": token("surface-bright"),
        "surface-container-lowest": token("surface-container-lowest"),
        "surface-container-low": token("surface-container-low"),
        "surface-container": token("surface-container"),
        "surface-container-high": token("surface-container-high"),
        "surface-container-highest": token("surface-container-highest"),
        "surface-variant": token("surface-variant"),
        background: token("background"),
        "on-background": token("on-background"),
        "on-surface": token("on-surface"),
        "on-surface-variant": token("on-surface-variant"),
        outline: token("outline"),
        "outline-variant": token("outline-variant"),
        "surface-tint": token("surface-tint"),
        primary: token("primary"),
        "on-primary": token("on-primary"),
        "primary-container": token("primary-container"),
        "on-primary-container": token("on-primary-container"),
        "primary-fixed": token("primary-fixed"),
        "primary-fixed-dim": token("primary-fixed-dim"),
        "inverse-primary": token("inverse-primary"),
        secondary: token("secondary"),
        "on-secondary": token("on-secondary"),
        "secondary-container": token("secondary-container"),
        "on-secondary-container": token("on-secondary-container"),
        "secondary-fixed": token("secondary-fixed"),
        "secondary-fixed-dim": token("secondary-fixed-dim"),
        "on-secondary-fixed": token("on-secondary-fixed"),
        "on-secondary-fixed-variant": token("on-secondary-fixed-variant"),
        tertiary: token("tertiary"),
        "tertiary-strong": token("tertiary-strong"),
        "on-tertiary": token("on-tertiary"),
        "tertiary-fixed": token("tertiary-fixed"),
        "tertiary-fixed-dim": token("tertiary-fixed-dim"),
        "on-tertiary-fixed": token("on-tertiary-fixed"),
        "on-tertiary-fixed-variant": token("on-tertiary-fixed-variant"),
        "tertiary-container": token("tertiary-container"),
        "on-tertiary-container": token("on-tertiary-container"),
        error: token("error"),
        "on-error": token("on-error"),
        "error-container": token("error-container"),
        "on-error-container": token("on-error-container"),
        "inverse-surface": token("inverse-surface"),
        "inverse-on-surface": token("inverse-on-surface"),
        ring: token("ring"),

        // Compatibility aliases: old semantic names kept so routes that have
        // not been re-skinned yet keep rendering. Removed with the old shell.
        bg: token("background"),
        border: token("outline-variant"),
        text: token("on-surface"),
        muted: token("on-surface-variant"),
        accent: {
          DEFAULT: token("primary"),
          hover: token("primary-container"),
          fg: token("on-primary"),
        },
        success: { DEFAULT: token("primary"), bg: token("surface-container-low") },
        warning: { DEFAULT: token("tertiary"), bg: token("tertiary-fixed") },
        danger: { DEFAULT: token("error"), bg: token("error-container") },
        info: { DEFAULT: token("secondary"), bg: token("secondary-container") },
        amber: token("tertiary"),
      },
      borderRadius: {
        // Level 1 (Soft) shapes: 4px controls, 8px cards, 12px overlays.
        input: "4px",
        card: "8px",
        dialog: "12px",
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.25rem",
        xl: "0.5rem",
        "2xl": "0.75rem",
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 3px 0 rgb(var(--shadow) / .05), 0 1px 2px -1px rgb(var(--shadow) / .04)",
        md: "0 10px 15px -3px rgb(var(--shadow) / .08), 0 4px 6px -4px rgb(var(--shadow) / .04)",
        lg: "0 20px 25px -5px rgb(var(--shadow) / .12), 0 4px 10px -6px rgb(var(--shadow) / .08)",
        inner: "inset 0 1px 2px 0 rgb(var(--shadow) / .06)",
        card: "0 1px 3px 0 rgb(var(--shadow) / .05), 0 1px 2px -1px rgb(var(--shadow) / .04)",
        dialog: "0 20px 25px -5px rgb(var(--shadow) / .12), 0 4px 10px -6px rgb(var(--shadow) / .08)",
      },
      spacing: {
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2rem",
        gutter: "1rem",
        "gutter-desktop": "1.5rem",
        margin: "1rem",
        "margin-tablet": "1.5rem",
        "margin-desktop": "2rem",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Plus Jakarta Sans", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        // Prototype type-role aliases: font-headline-sm, font-label-sm …
        "headline-lg": ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "headline-lg-mobile": ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "headline-md": ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "headline-sm": ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "display-lg": ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "display-lg-mobile": ["Plus Jakarta Sans", "Inter", "sans-serif"],
        "label-sm": ["Inter", "ui-sans-serif", "sans-serif"],
        "label-md": ["Inter", "ui-sans-serif", "sans-serif"],
        "title-md": ["Inter", "ui-sans-serif", "sans-serif"],
        "body-lg": ["Inter", "ui-sans-serif", "sans-serif"],
        "body-md": ["Inter", "ui-sans-serif", "sans-serif"],
        "body-sm": ["Inter", "ui-sans-serif", "sans-serif"],
        "data-mono": ["Inter", "ui-sans-serif", "sans-serif"],
      },
      fontSize: {
        // Type roles verbatim from the Stitch tailwind config.
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
        "headline-lg-mobile": [
          "24px",
          { lineHeight: "32px", letterSpacing: "-0.015em", fontWeight: "700" },
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
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "16px", fontWeight: "400" }],
        "label-md": ["13px", { lineHeight: "16px", fontWeight: "500" }],
        "label-sm": [
          "11px",
          { lineHeight: "14px", letterSpacing: "0.04em", fontWeight: "600" },
        ],
        "data-mono": [
          "14px",
          { lineHeight: "20px", letterSpacing: "-0.01em", fontWeight: "600" },
        ],
      },
    },
  },
  plugins: [],
};

export default config;
