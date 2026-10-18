// Session cookie helpers for server components and server actions (App Router).

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "../session";

export interface SessionUser {
  id: string;
  name: string;
}

/** The logged-in user, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    return session.userId ? { id: session.userId, name: session.userName ?? "" } : null;
  } catch {
    return null;
  }
}

/** Start a session after a successful login or signup. */
export async function setSessionUser(user: SessionUser): Promise<void> {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  session.userId = user.id;
  session.userName = user.name;
  await session.save();
}

/** Log out: destroy the session cookie. */
export async function destroySession(): Promise<void> {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  session.destroy();
}
