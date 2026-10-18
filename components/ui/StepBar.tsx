// Step bar (design.md §2): "Step 2 of 2" + a progress bar.

export function StepBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="mt-3 max-w-[560px]">
      <p className="text-sm font-medium leading-5 text-muted">
        Step {step} of {total}
      </p>
      <div
        className="mt-2 h-1.5 rounded-full bg-border"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${step} of ${total}`}
      >
        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
