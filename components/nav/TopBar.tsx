"use client";

// Phone top bar (design.md §3: under 1024 px a top bar). The bottom nav keeps the 4
// main items, so Market, Weather and Settings live up here.

import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const linkClass = `flex h-12 items-center whitespace-nowrap rounded-input px-2 text-sm text-muted hover:text-text ${focusRing}`;

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-3 lg:hidden">
      <p className="text-[18px] font-semibold leading-7 text-text">CropTrade</p>
      <div className="flex items-center gap-1">
        <Link href="/market" className={linkClass}>
          Market
        </Link>
        <Link href="/weather" className={linkClass}>
          Weather
        </Link>
        <Link href="/settings" className={linkClass}>
          Settings
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className={`flex h-12 items-center whitespace-nowrap rounded-input px-2 text-sm font-semibold text-accent hover:underline ${focusRing}`}
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
