// Labeled form input — the Stitch prototype field/button shapes: 36px inputs,
// 4px corners, white surface, outline-variant border, ring focus.

import type { InputHTMLAttributes } from "react";

export const inputClass =
  "mt-1 block h-9 rounded border border-outline-variant bg-surface-container-lowest px-2.5 text-body-md text-on-surface placeholder:text-outline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const primaryButtonClass =
  "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded bg-primary px-4 font-title-md text-title-md font-semibold text-on-primary hover:bg-primary-container transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded border border-outline-variant bg-surface-container-lowest px-4 font-title-md text-title-md font-semibold text-on-surface hover:bg-surface-container transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  helper?: string;
}

export function Field({ label, name, helper, id, ...inputProps }: FieldProps) {
  const fieldId = id ?? name;
  return (
    <div>
      <label htmlFor={fieldId} className="block font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
        {label}
      </label>
      <input id={fieldId} name={name} className={`${inputClass} w-full`} {...inputProps} />
      {helper ? <p className="mt-1 text-sm leading-5 text-muted">{helper}</p> : null}
    </div>
  );
}
