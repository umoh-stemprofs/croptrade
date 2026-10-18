"use client";

// Simple Retry button for error cards: re-runs the server component (router.refresh).

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetryButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        router.refresh();
        setBusy(false);
      }}
      className="inline-flex h-12 min-w-[48px] items-center justify-center rounded-input border border-accent bg-surface px-4 text-base font-semibold text-accent hover:bg-accent hover:text-accent-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
    >
      {busy ? "Retrying…" : "Retry"}
    </button>
  );
}
