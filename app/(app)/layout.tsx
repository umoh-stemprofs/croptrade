// Authenticated app shell (design.md §3: Agriculture web dashboard —
// 1024+ px: 240 px left sidebar + content grid, max width 1280.
// Under 640 px: one column + top bar + bottom nav with 4 items).
// Middleware already protects every page; this re-checks as defense in depth.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { Sidebar } from "@/components/nav/Sidebar";
import { TopBar } from "@/components/nav/TopBar";
import { BottomNav } from "@/components/nav/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userName={user.name} />
      <TopBar />
      <div className="lg:pl-60">
        <main className="mx-auto max-w-[1280px] px-4 pb-24 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
          {children}
          <footer className="mt-10 border-t border-border pt-4 text-sm leading-5 text-muted">
            Decision-support tool. You decide. Prices and rates show their source on every card.
          </footer>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
