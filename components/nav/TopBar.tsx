"use client";

// Phone top bar (design.md §3: under 1024 px a top bar; Settings and Log out live here
// because the bottom nav keeps the 4 main items).

import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
      <p className="text-[20px] font-semibold leading-7 text-text">CropTrade</p>
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className={`flex h-12 items-center rounded-input px-3 text-base text-muted hover:text-text ${focusRing}`}
        >
          Settings
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className={`h-12 rounded-input px-3 text-base font-semibold text-accent hover:underline ${focusRing}`}
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
