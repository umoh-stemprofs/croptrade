// Shared chart tooltip shell: white card, 1 px border, 14 px text.
// Tooltips work on touch (tap) and with a mouse; they restate the unit in words.

import type { ReactNode } from "react";

export function TooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-input border border-border bg-surface px-3 py-2 text-sm leading-5 shadow-card">
      {children}
    </div>
  );
}
