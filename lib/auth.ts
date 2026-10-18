// Auth logic (00-global §3): bcrypt cost 10, Zod on every server input.
// Pure and testable — no database, no cookies.

import { z } from "zod";
import bcrypt from "bcryptjs";

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(80, "Name must be 80 characters or fewer."),
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address.")
    .max(120, "Email must be 120 characters or fewer."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(100, "Password must be 100 characters or fewer."),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** First Zod issue message — one plain sentence saying what to fix. */
export function firstZodMessage(error: z.ZodError): string | null {
  return error.issues[0]?.message ?? null;
}

/** Hash with bcrypt cost 10 (00-global §3). */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** Compare against a stored hash. False for any failure — never throws. */
export async function verifyPassword(password: string, passHash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, passHash);
  } catch {
    return false;
  }
}

/** Normalize an email the same way everywhere. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
