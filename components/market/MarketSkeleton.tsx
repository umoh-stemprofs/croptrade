// Loading state for the Crop Prices screen: the same shapes as the real page (chart
// card, filter bar, commodity cards, table) so nothing jumps when data lands.

const pulse = "rounded bg-border/60 motion-safe:animate-pulse";

export function MarketSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading live prices from the World Food Programme…</span>

      <section className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className={`h-5 w-48 ${pulse}`} />
          <div className={`h-6 w-24 rounded-input ${pulse}`} />
        </div>
        <div className="mt-4 flex gap-3">
          <div className={`h-12 w-40 rounded-input ${pulse}`} />
          <div className={`h-12 w-24 rounded-input ${pulse}`} />
          <div className={`h-12 w-24 rounded-input ${pulse}`} />
        </div>
        <div className={`mt-4 h-[240px] w-full rounded-input ${pulse}`} />
      </section>

      <div className={`h-12 w-full rounded-input ${pulse}`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div
            key={index}
            className="rounded-card border border-border bg-surface p-5 shadow-card"
          >
            <div className={`h-4 w-28 ${pulse}`} />
            <div className={`mt-3 h-8 w-32 ${pulse}`} />
            <div className={`mt-3 h-3 w-40 ${pulse}`} />
          </div>
        ))}
      </div>

      <div className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-6">
        <div className={`h-4 w-40 ${pulse}`} />
        <div className={`mt-4 h-4 w-full ${pulse}`} />
        <div className={`mt-2 h-4 w-full ${pulse}`} />
        <div className={`mt-2 h-4 w-2/3 ${pulse}`} />
      </div>
    </div>
  );
}
