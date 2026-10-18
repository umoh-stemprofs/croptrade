"use client";

// Step 1 of 2: choose a crop from my stock (kg in stock shown next to it) and the
// kg to value. Plain GET form, so the wizard works without JavaScript too.

import { useState } from "react";
import { KgStepper } from "./KgStepper";
import { primaryButtonClass } from "@/components/ui/Field";
import type { StockCrop } from "@/lib/value";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function StepOneForm({ crops }: { crops: StockCrop[] }) {
  const [crop, setCrop] = useState(crops[0]?.crop ?? "");
  const selected = crops.find((item) => item.crop === crop);

  return (
    <form method="get" action="/value" className="mt-6 max-w-[560px] space-y-6">
      <input type="hidden" name="step" value="2" />
      <fieldset>
        <legend className="text-sm font-medium leading-5 text-muted">Choose a crop</legend>
        <div className="mt-2 space-y-2">
          {crops.map((item) => {
            const active = item.crop === crop;
            return (
              <label
                key={item.crop}
                className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-input border px-3 py-2 ${
                  active ? "border-accent bg-accent/5" : "border-border bg-surface"
                } hover:bg-bg ${focusRing}`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="crop"
                    value={item.crop}
                    checked={active}
                    onChange={() => setCrop(item.crop)}
                    className="h-5 w-5 accent-accent"
                  />
                  <span className="text-base font-medium text-text">{item.label}</span>
                </span>
                <span className="text-sm tabular-nums text-muted">{item.qtyKg} kg in stock</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <KgStepper stockKg={selected?.qtyKg ?? 0} />

      <button type="submit" className={`${primaryButtonClass} sm:w-auto sm:px-6`}>
        Next
      </button>
    </form>
  );
}
