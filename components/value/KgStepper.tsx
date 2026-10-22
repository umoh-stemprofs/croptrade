"use client";

// Kg stepper (04-croptrade.md wizard): − / + buttons around a normal number input,
// so the keyboard still works. Above 0; the server validates again.

import { useState } from "react";
import { inputClass } from "@/components/ui/Field";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function KgStepper({ stockKg }: { stockKg: number }) {
  const [value, setValue] = useState("1");

  function bump(delta: number) {
    const current = Number(value);
    const base = Number.isFinite(current) && current > 0 ? current : 0;
    const next = Math.max(0.1, Math.round((base + delta) * 100) / 100);
    setValue(String(next));
  }

  return (
    <div>
      <label htmlFor="qtyKg" className="block text-sm font-medium leading-5 text-muted">
        Kg to value
      </label>
      <div className="mt-1 flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => bump(-1)}
          aria-label="One kg less"
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-input border border-border bg-surface text-[20px] font-semibold text-text hover:bg-bg ${focusRing}`}
        >
          −
        </button>
        <input
          id="qtyKg"
          name="qtyKg"
          type="number"
          min="0.1"
          step="any"
          required
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={`${inputClass} mt-0 w-full text-center`}
        />
        <button
          type="button"
          onClick={() => bump(1)}
          aria-label="One kg more"
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-input border border-border bg-surface text-[20px] font-semibold text-text hover:bg-bg ${focusRing}`}
        >
          +
        </button>
      </div>
      <p className="mt-1 text-sm leading-5 text-muted">
        You have {stockKg} kg of this crop in stock. More than 0 kg.
      </p>
    </div>
  );
}
