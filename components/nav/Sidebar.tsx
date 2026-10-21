"use client";

// Desktop sidebar (design.md §3: 1024+ px left sidebar 240 px, accent on the active item).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import { NAV_ITEMS, isActivePath } from "./NavLinks";
import { NavIcon } from "./icons";
import { ThemeToggle } from "@/components/ThemeToggle";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex items-start justify-between gap-2 px-6 pb-6 pt-6">
        <div>
          <p className="text-[20px] font-semibold leading-7 text-text">CropTrade</p>
          <p className="mt-1 text-sm leading-5 text-muted">What is my crop worth abroad?</p>
        </div>
        <ThemeToggle compact />
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex h-12 items-center gap-3 rounded-input px-3 text-base ${focusRing} ${
                active
                  ? "bg-accent/10 font-semibold text-accent"
                  : "text-muted hover:bg-bg hover:text-text"
              }`}
            >
              <NavIcon name={item.icon} className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-6 py-4">
        <p className="truncate text-sm text-muted" title={userName}>
          {userName}
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            className={`-ml-1 block h-12 text-left text-base font-semibold text-accent hover:underline ${focusRing}`}
          >
            Log out
          </button>
        </form>
        <p className="mt-1 text-sm leading-5 text-muted">Decision-support tool. You decide.</p>
      </div>
    </aside>
  );
}
