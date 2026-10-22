// Loading skeletons (design.md §2: every screen defines a loading state).
// Used as Suspense fallbacks while a chart's data is still on the way.
// Animation stops for reduced-motion users (motion-safe).

const pulse = "rounded bg-border/60 motion-safe:animate-pulse";

export function ChartSkeleton() {
  return (
    <section
      role="status"
      aria-live="polite"
      className="bg-surface-container-lowest rounded-xl border border-outline-variant p-4 shadow-sm sm:p-6"
    >
      <span className="sr-only">Loading chart…</span>
      <div className={`h-5 w-40 ${pulse}`} />
      <div className={`mt-4 h-[220px] w-full rounded-input ${pulse}`} />
      <div className={`mt-3 h-4 w-24 ${pulse}`} />
    </section>
  );
}

/** Two chart cards side by side (dashboard). */
export function ChartSkeletonPair() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
  );
}

/** A chart plus a few list rows (valuations page). */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="mt-6 space-y-6">
      <span className="sr-only">Loading saved valuations…</span>
      <ChartSkeleton />
      <div className={`h-20 w-full rounded-xl ${pulse}`} />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={`h-16 w-full rounded-xl ${pulse}`} />
      ))}
    </div>
  );
}
