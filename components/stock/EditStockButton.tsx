"use client";

// Edit one stock row inline (server action re-checks ownership).
// Styled as the prototype's compact ledger action button.

import { useState } from "react";
import { updateStockAction } from "@/lib/actions/stock";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const inputCls =
  "mt-1 block h-9 w-full rounded bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface px-2 " +
  focusRing;

const labelCls = "block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant";

export function EditStockButton({
  id,
  qtyKg,
  note,
}: {
  id: string;
  qtyKg: number;
  note: string | null;
}) {
  const [open, setOpen] = useState(false);

  // The action finishes with a redirect: on success the row below shows the new
  // values, on failure the error sentence appears at the top of the page — either
  // way the inline editor is done, so close it instead of leaving it open.
  async function save(formData: FormData) {
    try {
      await updateStockAction(formData);
    } catch {
      // A redirect thrown by the action is not a failure to report here.
    } finally {
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Edit batch"
        aria-label="Edit batch"
        className={`p-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors ${focusRing}`}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          edit
        </span>
      </button>
    );
  }

  return (
    <form
      action={save}
      className="w-full space-y-3 rounded border border-outline-variant bg-surface-container-low p-space-md"
    >
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor={`qty-${id}`} className={labelCls}>
          Kg
        </label>
        <input
          id={`qty-${id}`}
          name="qtyKg"
          type="number"
          min="0.1"
          step="any"
          required
          defaultValue={qtyKg}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor={`note-${id}`} className={labelCls}>
          Note
        </label>
        <input
          id={`note-${id}`}
          name="note"
          type="text"
          maxLength={200}
          defaultValue={note ?? ""}
          placeholder="Optional"
          className={inputCls}
        />
      </div>
      <div className="flex gap-space-sm">
        <button
          type="submit"
          className={`h-9 px-space-md rounded bg-primary text-on-primary font-title-md text-title-md font-semibold hover:bg-primary-container transition-colors ${focusRing}`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`h-9 px-space-md rounded border border-outline-variant bg-surface-container-lowest hover:bg-surface-container font-label-md text-label-md text-on-surface transition-colors ${focusRing}`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
