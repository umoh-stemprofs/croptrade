// Authenticated app shell — the Google Stitch page frame: fixed header,
// `main` with the centered max-w-6xl column, and the footer band.
// Middleware already protects every page; this re-checks as defense in depth.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { Header } from "@/components/nav/Header";
import { Footer } from "@/components/nav/Footer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <>
      <Header userName={user.name} />
      {/* pt matches the fixed h-20 header; the extra mobile offset covers the
          wrapped pill nav row on small screens. */}
      <main className="w-full flex-1 bg-surface pt-[148px] lg:pt-20">
        <div className="max-w-6xl mx-auto py-space-xl px-4 sm:px-6">
          <div className="flex flex-col w-full">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
