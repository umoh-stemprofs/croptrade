// iron-session options (edge-safe: no server-only imports — also used by middleware.ts).
// Cookie: httpOnly, sameSite lax, secure in production (00-global §3).

import type { SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  userName?: string;
}

export const sessionOptions: SessionOptions = {
  // SESSION_SECRET lives in .env (git-ignored), 32+ random characters.
  password: process.env.SESSION_SECRET ?? "",
  cookieName: "croptrade_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  },
};
