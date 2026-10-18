// Labeled form input (design.md §2: label above, helper below, 48px touch target).

import type { InputHTMLAttributes } from "react";

export const inputClass =
  "mt-1 block h-12 w-full rounded-input border border-border bg-surface px-3 text-base text-text placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const primaryButtonClass =
  "inline-flex h-12 w-full items-center justify-center rounded-input bg-accent px-4 text-base font-semibold text-accent-fg hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex h-12 w-full items-center justify-center rounded-input border border-border bg-surface px-4 text-base font-semibold text-text hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  helper?: string;
}

export function Field({ label, name, helper, id, ...inputProps }: FieldProps) {
  const fieldId = id ?? name;
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium leading-5 text-muted">
        {label}
      </label>
      <input id={fieldId} name={name} className={inputClass} {...inputProps} />
      {helper ? <p className="mt-1 text-sm leading-5 text-muted">{helper}</p> : null}
    </div>
  );
}
