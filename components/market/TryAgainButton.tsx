"use client";

// "Try again" for the live price error state. Re-runs the server component, which
// retries the WFP/HDX fetch. There is no cached fallback: either fresh numbers come
// back or the error state stays.

import { useRouter } from "next/navigation";
import { useState } from "react";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function TryAgainButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={() => {
        setBusy(true);
        router.refresh();
        // The refresh is a server round-trip; release the button so a slow network
        // never leaves it stuck disabled.
        setTimeout(() => setBusy(false), 1500);
      }}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-input bg-accent px-5 text-base font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-60 ${focusRing}`}
    >
      {busy ? (
        <>
          <span
            aria-hidden="true"
            className="h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-accent-fg border-t-transparent"
          />
          Fetching…
        </>
      ) : (
        label
      )}
    </button>
  );
}
