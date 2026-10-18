// One-sentence error messages for ?error= codes (login, signup).
// Codes are whitelisted server-side; the page maps a code to its sentence.

export const AUTH_ERRORS: Record<string, string> = {
  "invalid-input":
    "Check the form: name, a valid email and a password of at least 8 characters are required.",
  "wrong-credentials": "Wrong email or password. Try again.",
  "email-taken": "An account with this email already exists. Log in instead.",
  "no-demo":
    "The demo account is not set up on this server. Create an account instead.",
  server: "Something went wrong. Try again in a moment.",
};

/** The sentence for an error code, or null when there is no error. Unknown codes show nothing. */
export function authErrorMessage(code: string | string[] | undefined): string | null {
  const key = Array.isArray(code) ? code[0] : code;
  return key ? (AUTH_ERRORS[key] ?? null) : null;
}
