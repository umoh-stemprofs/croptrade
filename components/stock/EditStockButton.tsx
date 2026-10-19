"use client";

// Edit one stock row inline (server action re-checks ownership).

import { useState } from "react";
import { updateStockAction } from "@/lib/actions/stock";
import { inputClass, primaryButtonClass } from "@/components/ui/Field";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
        className={`flex h-12 items-center rounded-input border border-border bg-surface px-3 text-base font-medium text-text hover:bg-bg ${focusRing}`}
      >
        Edit
      </button>
    );
  }

  return (
    <form
      action={save}
      className="w-full space-y-3 rounded-input border border-border bg-bg p-4"
    >
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor={`qty-${id}`} className="block text-sm font-medium leading-5 text-muted">
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
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`note-${id}`} className="block text-sm font-medium leading-5 text-muted">
          Note
        </label>
        <input
          id={`note-${id}`}
          name="note"
          type="text"
          maxLength={200}
          defaultValue={note ?? ""}
          placeholder="Optional"
          className={inputClass}
        />
      </div>
      <div className="flex gap-3">
        <button type="submit" className={`${primaryButtonClass} w-auto px-4`}>
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`inline-flex h-12 w-auto items-center justify-center rounded-input border border-border bg-surface px-4 text-base font-medium text-text hover:bg-bg ${focusRing}`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
