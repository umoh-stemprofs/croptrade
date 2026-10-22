"use client";

// Password input with a show/hide toggle (S-LOGIN-W: "Password with show/hide").

import { useState } from "react";
import { inputClass } from "./Field";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function PasswordField({
  label,
  name,
  autoComplete,
  helper,
}: {
  label: string;
  name: string;
  autoComplete: string;
  helper?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium leading-5 text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className={`${inputClass} w-full pr-20`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className={`absolute right-1 top-1/2 h-10 -translate-y-1/2 rounded-input px-3 text-sm font-medium text-accent hover:underline ${focusRing}`}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {helper ? <p className="mt-1 text-sm leading-5 text-muted">{helper}</p> : null}
    </div>
  );
}
