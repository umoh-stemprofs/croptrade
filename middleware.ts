// Route protection (00-global §3: "Every page except login and signup needs a session").
// Defense in depth: pages re-check the session too, and every server action re-checks it.

import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "./lib/session";

const PUBLIC_PAGES = new Set(["/login", "/signup"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PAGES.has(pathname)) return NextResponse.next();
  // The market API is the public "simulated live feed"; static files need no session.
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  if (!session.userId) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
