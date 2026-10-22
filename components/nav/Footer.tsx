// Google Stitch footer band — verbatim from the prototype pages.

export function Footer() {
  return (
    <footer className="w-full bg-surface-container-low py-space-lg mt-auto shadow-[0_-1px_8px_rgba(0,0,0,0.02)]">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-space-md text-on-surface-variant font-label-md text-label-md">
        <div className="flex items-center gap-space-sm">
          <span className="font-headline-sm text-headline-sm text-primary font-bold">
            CropTrade
          </span>
          <span>• Agritech Global Exchange</span>
        </div>
        <div className="flex items-center gap-space-lg">
          <span className="font-data-mono text-data-mono">UTC+00:00 GRAIN-DESK</span>
          <span>© 2026 CropTrade Platform. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
