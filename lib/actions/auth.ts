"use server";

// Auth server actions: signup, login, logout, demo login.
// Every input is Zod-validated on the server; bcrypt cost 10; one plain sentence per
// error via whitelisted ?error= codes; the session cookie is httpOnly + sameSite lax.

import { redirect } from "next/navigation";
import { prisma } from "../db";
import { hashPassword, loginSchema, normalizeEmail, signupSchema, verifyPassword } from "../auth";
import { DEMO_EMAIL, DEFAULT_FARM_LAT, DEFAULT_FARM_LON } from "../config";
import { destroySession, setSessionUser } from "../server/session";

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) redirect("/signup?error=invalid-input");
  const { name, email, password } = parsed.data;

  const outcome = await (async () => {
    try {
      if (await prisma.user.findUnique({ where: { email } })) return "email-taken" as const;
      const passHash = await hashPassword(password);
      const user = await prisma.user.create({ data: { email, name, passHash } });
      const farm = await prisma.farm.create({
        data: {
          userId: user.id,
          name: `${name}'s Farm`,
          lat: DEFAULT_FARM_LAT,
          lon: DEFAULT_FARM_LON,
          currency: "NGN",
        },
      });
      await prisma.settings.create({ data: { farmId: farm.id } });
      return { id: user.id, name: user.name };
    } catch (e) {
      return isUniqueViolation(e) ? ("email-taken" as const) : ("server" as const);
    }
  })();

  if (outcome === "email-taken") redirect("/signup?error=email-taken");
  if (outcome === "server") redirect("/signup?error=server");
  await setSessionUser(outcome);
  redirect("/");
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) redirect("/login?error=invalid-input");
  const { email, password } = parsed.data;

  const user = await (async () => {
    try {
      return await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, passHash: true },
      });
    } catch {
      return "server" as const;
    }
  })();

  if (user === "server") redirect("/login?error=server");
  // One plain sentence for a wrong password — and for an unknown email, so an
  // attacker cannot tell which emails exist.
  if (!user) redirect("/login?error=wrong-credentials");
  const ok = await verifyPassword(password, user.passHash);
  if (!ok) redirect("/login?error=wrong-credentials");
  await setSessionUser({ id: user.id, name: user.name });
  redirect("/");
}

export async function demoLoginAction() {
  if (process.env.DEMO_MODE !== "true") redirect("/login");
  const user = await (async () => {
    try {
      return await prisma.user.findUnique({
        where: { email: DEMO_EMAIL },
        select: { id: true, name: true },
      });
    } catch {
      return "server" as const;
    }
  })();
  if (user === "server") redirect("/login?error=server");
  if (!user) redirect("/login?error=no-demo");
  await setSessionUser({ id: user.id, name: user.name });
  redirect("/");
}

export async function logoutAction() {
  try {
    await destroySession();
  } catch {
    // A broken session cookie must still log the user out of the page.
  }
  redirect("/login");
}
