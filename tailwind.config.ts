import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F7F8FA",
        surface: "#FFFFFF",
        border: "#E4E7EC",
        text: "#101828",
        muted: "#475467",
        success: { DEFAULT: "#1B7F3B", bg: "#E7F6EC" },
        warning: { DEFAULT: "#B54708", bg: "#FEF0C7" },
        danger: { DEFAULT: "#B42318", bg: "#FEE4E2" },
        info: { DEFAULT: "#175CD3", bg: "#D1E9FF" },
        accent: {
          DEFAULT: "#00796B",
          hover: "#00695C",
          fg: "#FFFFFF",
        },
      },
      borderRadius: {
        input: "8px",
        card: "12px",
        dialog: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)",
        dialog: "0 12px 24px -4px rgba(16,24,40,.16)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
