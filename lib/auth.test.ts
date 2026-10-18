// Auth tests: signup validation, wrong password, passwords stored hashed (cost 10).

import { describe, expect, it } from "vitest";
import {
  firstZodMessage,
  hashPassword,
  loginSchema,
  normalizeEmail,
  signupSchema,
  verifyPassword,
} from "./auth";

const valid = { name: "Ada Obi", email: "ada@example.com", password: "strongpass1" };

describe("signup validation (Zod, server input)", () => {
  it("accepts a valid signup", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty name with one plain sentence", () => {
    const r = signupSchema.safeParse({ ...valid, name: "   " });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstZodMessage(r.error)).toBe("Enter your name.");
  });

  it("rejects an invalid email with one plain sentence", () => {
    const r = signupSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstZodMessage(r.error)).toBe("Enter a valid email address.");
  });

  it("rejects a password under 8 characters with one plain sentence", () => {
    const r = signupSchema.safeParse({ ...valid, password: "short7" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(firstZodMessage(r.error)).toBe("Password must be at least 8 characters.");
    }
  });
});

describe("login validation", () => {
  it("requires an email and a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });

  it("normalizes email case and spaces", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("passwords are stored hashed (bcrypt cost 10)", () => {
  it("the stored value is a cost-10 bcrypt hash, never the plain password", async () => {
    const hash = await hashPassword("croptrade123");
    // bcryptjs (pure JS) writes the $2a$ variant; cost is 10 either way.
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
    expect(hash).not.toBe("croptrade123");
    expect(hash).not.toContain("croptrade123");
  });

  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("croptrade123");
    await expect(verifyPassword("croptrade123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("never throws on a broken or empty hash", async () => {
    await expect(verifyPassword("anything", "not-a-bcrypt-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
  });
});
