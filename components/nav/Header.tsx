"use client";

// Google Stitch shell header — copied verbatim from the prototype pages
// (farm_overview, my_crop_stock, crop_prices_today, money_converter,
// farm_weather): fixed h-20 bar, eco logo tile, centred pill nav with a
// primary-container active state, theme toggle, and the user chip.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { label: "Overview", href: "/" },
  { label: "Stock", href: "/stock" },
  { label: "Market", href: "/market" },
  { label: "Weather", href: "/weather" },
  { label: "Rates", href: "/rates" },
];

const idleClass =
  "min-h-[56px] px-space-md py-space-sm rounded-lg font-title-md text-title-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all flex items-center justify-center text-center leading-none";
const activeClass =
  "min-h-[56px] px-space-md py-space-sm rounded-lg transition-all flex items-center justify-center leading-none bg-primary-container text-on-primary-container font-title-md text-title-md shadow-sm";

export function Header({ userName }: { userName: string }) {
  const pathname = usePathname();

  // Rates covers the converter as well — the prototype keeps Money Converter
  // under the Rates tab.
  const isActive = (href: string) =>
    href === "/rates"
      ? pathname === "/rates" || pathname.startsWith("/rates/") || pathname.startsWith("/converter")
      : href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 max-w-6xl mx-auto px-6 flex flex-wrap lg:flex-nowrap items-center justify-between gap-space-md">
        <Link href="/" className="flex items-center gap-space-sm shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container shadow-sm">
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
              eco
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface leading-none">
              CropTrade
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mt-0.5">
              Agritech Simplicity
            </span>
          </div>
        </Link>

        <nav
          aria-label="Main"
          className="order-3 lg:order-none w-full lg:w-auto flex justify-center lg:justify-start items-center gap-space-xs p-1 bg-surface-container-low rounded-xl overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${active ? activeClass : idleClass} shrink-0`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-space-sm shrink-0">
          <ThemeToggle />
          <div className="h-8 w-px bg-outline-variant/30 hidden sm:block mx-space-xs"></div>
          <UserChip userName={userName} />
        </div>
      </div>
    </header>
  );
}

// The prototype's user chip. Clicking it opens a small menu (logout lives
// here — the Stitch shell has no separate logout button).
function UserChip({ userName }: { userName: string }) {
  return (
    <details className="relative">
      <summary className="flex items-center gap-space-sm p-1 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-on-primary text-[18px]" aria-hidden="true">
            person
          </span>
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="font-label-md text-label-md text-on-surface leading-tight">
            {userName}
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            Online
          </span>
        </div>
      </summary>
      <div className="absolute right-0 top-full mt-1 w-56 card p-1 z-50">
        <Link
          href="/settings"
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 font-title-md text-title-md text-on-surface hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            settings
          </span>
          Settings
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 font-title-md text-title-md text-on-surface hover:bg-surface-container transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              logout
            </span>
            Log out
          </button>
        </form>
      </div>
    </details>
  );
}
