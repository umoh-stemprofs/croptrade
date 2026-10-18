// Nav items shared by the desktop sidebar and the phone bottom nav (design.md §3).

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
  { href: "/settings", label: "Settings", icon: "settings" },
];

/** Bottom nav shows the 4 main items (design.md §3: phone bottom nav = 4 items). */
export const BOTTOM_NAV_ITEMS: NavItem[] = NAV_ITEMS.slice(0, 4);

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
