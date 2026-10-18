// One-sentence error and success notices (design.md §2: status is color + icon + word).

function AlertIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}

function TickIcon({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

export function ErrorLine({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-input border border-danger/30 bg-danger-bg px-3 py-2 text-base leading-6 text-danger"
    >
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
      {message}
    </p>
  );
}

export function SuccessLine({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="mt-4 flex items-start gap-2 rounded-input border border-success/30 bg-success-bg px-3 py-2 text-base leading-6 text-success"
    >
      <TickIcon className="mt-0.5 h-5 w-5 shrink-0" />
      {message}
    </p>
  );
}
