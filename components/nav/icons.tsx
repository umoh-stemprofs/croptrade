// Line icons for the nav (design.md: Lucide-style, 1.75 stroke, line style).
// Inlined so no extra dependency is needed.

export type IconName =
  | "dashboard"
  | "stock"
  | "market"
  | "weather"
  | "valuations"
  | "rates"
  | "settings";

export function NavIcon({ name, className }: { name: IconName; className: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };
  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "stock":
      return (
        <svg {...common}>
          <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case "market":
      return (
        <svg {...common}>
          <path d="m22 7-8.5 8.5-5-5L2 17" />
          <path d="M16 7h6v6" />
        </svg>
      );
    case "weather":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3.5" />
          <path d="M8 2v1.5M2 8h1.5M12.7 3.3l-1 1M4.3 11.7l-1 1" />
          <path d="M14 21a4 4 0 0 0 0-8 6 6 0 0 0-11.3 1.7A3.5 3.5 0 0 0 4 21z" />
        </svg>
      );
    case "valuations":
      return (
        <svg {...common}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
          <path d="M9 7.5h6M9 11.5h6M9 15.5h4" />
        </svg>
      );
    case "rates":
      return (
        <svg {...common}>
          <path d="M4 8h14" />
          <path d="m15 5 3 3-3 3" />
          <path d="M20 16H6" />
          <path d="m9 13-3 3 3 3" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="8" cy="12" r="2" />
          <circle cx="14" cy="18" r="2" />
        </svg>
      );
  }
}
