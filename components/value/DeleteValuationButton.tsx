"use client";

// Delete one saved valuation behind a confirm dialog (design.md §2: two buttons,
// verbs not Yes/No). The server action re-checks ownership.

import { useState } from "react";
import { deleteValuationAction } from "@/lib/actions/valuations";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function DeleteValuationButton({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex h-12 items-center rounded-input border border-danger/30 bg-surface px-3 text-base font-medium text-danger hover:bg-danger-bg ${focusRing}`}
      >
        Delete
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-valuation-${id}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4"
        >
          <div className="w-full max-w-[420px] rounded-2xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-lg">
            <h2
              id={`delete-valuation-${id}`}
              className="text-headline-sm text-text"
            >
              Delete this saved value?
            </h2>
            <p className="mt-2 text-base leading-6 text-muted">
              {label} This removes it from your saved valuations. This cannot be undone.
            </p>
            <form action={deleteValuationAction} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input type="hidden" name="id" value={id} />
              <button
                type="submit"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-input bg-danger px-4 text-base font-semibold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
              >
                Delete valuation
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(false)}
                className={`inline-flex h-12 flex-1 items-center justify-center rounded-input border border-border bg-surface px-4 text-base font-semibold text-text hover:bg-bg ${focusRing}`}
              >
                Keep it
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
