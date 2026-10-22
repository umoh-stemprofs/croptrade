// Create account (S-SIGNUP-W). Name, email, password (at least 8 characters),
// every input Zod-validated on the server. Errors are whitelisted ?error= codes.

import Link from "next/link";
import { redirect } from "next/navigation";
import { signupAction } from "@/lib/actions/auth";
import { authErrorMessage } from "@/lib/errors";
import { getSessionUser } from "@/lib/server/session";
import { Field, primaryButtonClass } from "@/components/ui/Field";
import { PasswordField } from "@/components/ui/PasswordField";
import { ErrorLine } from "@/components/ui/Notice";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const user = await getSessionUser();
  if (user) redirect("/");
  const error = authErrorMessage(searchParams.error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-[420px] bg-surface-container-lowest rounded-xl border border-outline-variant p-8 shadow-sm">
        <h1 className="font-display text-display-lg-mobile sm:text-display-lg text-on-surface tracking-tight">Create your account</h1>
        <p className="mt-1 text-base leading-6 text-muted">
          Track your stock and see what it is worth abroad.
        </p>
        {error ? <ErrorLine message={error} /> : null}
        <form action={signupAction} className="mt-6 space-y-4">
          <Field label="Name" name="name" required autoComplete="name" maxLength={80} />
          <Field
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
          />
          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            helper="At least 8 characters."
          />
          <button type="submit" className={primaryButtonClass}>
            Create account
          </button>
        </form>
        <p className="mt-6 text-sm leading-5 text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent underline underline-offset-2">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
