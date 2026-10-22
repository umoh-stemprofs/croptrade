// Data-source badge (design.md §2): every card that shows prices, weather or
// exchange rates says Saved data or Manual when the number is NOT a fresh fetch.
// The "Live" chip was removed at the user's request — fresh data needs no label —
// so `kind: "live"` renders nothing and only states worth flagging stay visible.
// Status is never color alone: color + icon + word.

export type BadgeSpec =
  | { kind: "live"; note?: string }
  | { kind: "saved"; ageLabel: string }
  | { kind: "manual" };

function ClockIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

// Level 1 (Soft) shapes: a badge is a 4px chip — pills are reserved for status dots.
const base =
  "inline-flex items-center gap-1.5 rounded-input border px-2.5 py-0.5 text-sm font-medium leading-5";

export function DataSourceBadge({ badge }: { badge: BadgeSpec }) {
  switch (badge.kind) {
    case "live":
      // Fresh live data carries no chip — the user removed the "Live" badges.
      return null;
    case "saved":
      return (
        <span
          className={`${base} border-warning/30 bg-warning-bg text-warning`}
          title="Not fetched now — served from saved data"
        >
          <ClockIcon className="h-4 w-4" />
          Saved data · {badge.ageLabel}
        </span>
      );
    case "manual":
      return (
        <span
          className={`${base} border-border bg-surface text-muted`}
          title="Rate typed in by the farmer"
        >
          <span className="h-2 w-2 rounded-full bg-muted" aria-hidden="true" />
          Manual
        </span>
      );
  }
}

export function OldRateTag() {
  return (
    <span
      className={`${base} border-warning/30 bg-warning-bg text-warning`}
      title="Old rate — older than 7 days. It still calculates."
    >
      <ClockIcon className="h-4 w-4" />
      Old rate
    </span>
  );
}
