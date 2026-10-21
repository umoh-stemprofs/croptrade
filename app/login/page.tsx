// Login (S-LOGIN-W). Errors come back as whitelisted ?error= codes — one plain sentence.
// "Try demo account" shows only when DEMO_MODE=true (button hidden otherwise).

import Link from "next/link";
import { redirect } from "next/navigation";
import { demoLoginAction, loginAction } from "@/lib/actions/auth";
import { authErrorMessage } from "@/lib/errors";
import { getSessionUser } from "@/lib/server/session";
import { Field, primaryButtonClass, secondaryButtonClass } from "@/components/ui/Field";
import { PasswordField } from "@/components/ui/PasswordField";
import { ErrorLine } from "@/components/ui/Notice";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const user = await getSessionUser();
  if (user) redirect("/");
  const error = authErrorMessage(searchParams.error);
  const demoMode = process.env.DEMO_MODE === "true";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-[420px] rounded-card border border-border bg-surface p-8 shadow-card">
        <h1 className="font-display text-display-lg-mobile sm:text-display-lg">CropTrade</h1>
        <p className="mt-1 text-base leading-6 text-muted">
          What is my crop worth abroad? Track your stock and see its export value.
        </p>
        {error ? <ErrorLine message={error} /> : null}
        <form action={loginAction} className="mt-6 space-y-4">
          <Field
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
          />
          <PasswordField label="Password" name="password" autoComplete="current-password" />
          <button type="submit" className={primaryButtonClass}>
            Log in
          </button>
        </form>
        {demoMode ? (
          <form action={demoLoginAction} className="mt-3">
            <button type="submit" className={secondaryButtonClass}>
              Try demo account
            </button>
          </form>
        ) : null}
        <p className="mt-6 text-sm leading-5 text-muted">
          No account yet?{" "}
          <Link
            href="/signup"
            className="font-semibold text-accent underline underline-offset-2"
          >
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}
