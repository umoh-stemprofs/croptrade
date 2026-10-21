// Nav items shared by the desktop sidebar and the phone bottom nav (design.md §3).
// The phone bottom nav stays at 4 items: Dashboard, Stock, Valuations, Rates.
// Market, Weather and Settings live in the phone top bar.

import type { IconName } from "./icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/stock", label: "Stock", icon: "stock" },
  { href: "/market", label: "Market", icon: "market" },
  { href: "/weather", label: "Weather", icon: "weather" },
  { href: "/valuations", label: "Valuations", icon: "valuations" },
  { href: "/rates", label: "Rates", icon: "rates" },
  { href: "/converter", label: "Converter", icon: "converter" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

/** Phone bottom nav: exactly 4 items (design.md §3). */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/stock", label: "Stock", icon: "stock" },
  { href: "/valuations", label: "Valuations", icon: "valuations" },
  { href: "/rates", label: "Rates", icon: "rates" },
];

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
