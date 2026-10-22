// Shared chart tooltip shell: white card, 1 px border, 14 px text.
// Tooltips work on touch (tap) and with a mouse; they restate the unit in words.

import type { ReactNode } from "react";

export function TooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-sm leading-5 shadow-md">
      {children}
    </div>
  );
}
