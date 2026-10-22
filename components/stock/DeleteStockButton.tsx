"use client";

// Delete one stock row behind a confirm dialog (prototype Tier 3 modal shape:
// scrim, 12px modal, warning icon, verb buttons). The server action re-checks
// ownership.

import { useState } from "react";
import { deleteStockAction } from "@/lib/actions/stock";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function DeleteStockButton({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Delete batch"
        aria-label={`Delete ${label}`}
        className={`p-1.5 rounded hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors ${focusRing}`}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          delete
        </span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-title-${id}`}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-[rgb(var(--shadow)/0.6)]"
            onClick={() => setOpen(false)}
          ></div>
          <div
            className={`relative w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-lg p-space-lg ${focusRing}`}
          >
            <div className="flex items-start gap-space-sm">
              <span className="material-symbols-outlined text-error text-[26px]" aria-hidden="true">
                warning
              </span>
              <div>
                <h2 id={`delete-title-${id}`} className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Delete this batch?
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  “{label}” will be removed from the ledger. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-space-lg flex justify-end gap-space-sm">
              <form action={deleteStockAction}>
                <input type="hidden" name="id" value={id} />
                <button
                  type="submit"
                  className={`h-9 px-space-md rounded bg-error text-on-error font-label-md text-label-md font-semibold hover:opacity-90 transition-opacity ${focusRing}`}
                >
                  Delete
                </button>
              </form>
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(false)}
                className={`h-9 px-space-md rounded border border-outline-variant bg-surface-container-lowest hover:bg-surface-container font-label-md text-label-md text-on-surface transition-colors ${focusRing}`}
              >
                Keep it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
