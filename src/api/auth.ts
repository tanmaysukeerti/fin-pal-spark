import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";
import { getRepo } from "../db/repo";
import { newId } from "../lib/id";
import { hashPassword, verifyPassword, newSessionToken } from "../lib/auth/password";
import {
  createSession,
  destroySession,
  getCurrentUser,
  toPublicUser,
  type PublicUser,
} from "../lib/auth/session";
import { starterAchievements } from "../db/seed-data";
import { toPaise } from "../lib/money";
import { rateLimit, rateLimitReset } from "../lib/rate-limit";
import { sendEmail } from "../lib/email";
import type { Account, VerificationToken } from "../db/schema";

export type AuthResult = { user: PublicUser; verifyDevLink?: string } | { error: string };

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

function baseUrl(): string {
  try {
    return new URL(getRequestUrl()).origin;
  } catch {
    return "";
  }
}

async function issueToken(userId: string, kind: "verify_email" | "password_reset", ttlMs: number): Promise<VerificationToken> {
  const repo = await getRepo();
  const token: VerificationToken = {
    id: newSessionToken(),
    userId,
    kind,
    expiresAt: new Date(Date.now() + ttlMs),
    usedAt: null,
    createdAt: new Date(),
  };
  await repo.verificationTokens.create(token);
  return token;
}

/** Return the currently signed-in user (or null). Used by the app auth guard. */
export const meFn = createServerFn({ method: "GET" }).handler(async () => {
  return await getCurrentUser();
});

export const signupFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => signupSchema.parse(data))
  .handler(async ({ data }): Promise<AuthResult> => {
    const rl = rateLimit(`signup:${data.email}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) return { error: "Too many attempts. Please try again later." };

    const repo = await getRepo();
    const existing = await repo.users.getByEmail(data.email);
    if (existing) return { error: "An account with this email already exists." };

    const now = new Date();
    const id = newId();
    const user = {
      id,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      name: data.name,
      avatarInitial: data.name.charAt(0).toUpperCase() || "U",
      city: "India",
      level: 1,
      xp: 50,
      emailVerified: false,
      onboardedAt: null,
      createdAt: now,
    };
    await repo.users.create(user);

    // Give new users a starter wallet + achievement set so the app isn't empty.
    const wallet: Account = {
      id: newId(),
      userId: id,
      name: "UPI Wallet",
      kind: "upi",
      balance: toPaise(500),
      linked: true,
      createdAt: now,
    };
    await repo.accounts.create(wallet);
    for (const a of starterAchievements(id)) await repo.achievements.create(a);

    // Email verification (non-blocking — the app is usable meanwhile).
    const token = await issueToken(id, "verify_email", 24 * 60 * 60 * 1000);
    const link = `${baseUrl()}/verify-email?token=${token.id}`;
    const email = await sendEmail({
      to: data.email,
      subject: "Verify your finAI-Buddy email",
      text: `Welcome to finAI-Buddy! Confirm your email:\n${link}`,
      link,
    });

    await createSession(id);
    return { user: toPublicUser(user), verifyDevLink: email.devLink };
  });

export const loginFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => loginSchema.parse(data))
  .handler(async ({ data }): Promise<AuthResult> => {
    const rl = rateLimit(`login:${data.email}`, 8, 15 * 60 * 1000);
    if (!rl.allowed) {
      const mins = Math.ceil(rl.retryAfterMs / 60000);
      return { error: `Too many attempts. Try again in ${mins} min.` };
    }

    const repo = await getRepo();
    const user = await repo.users.getByEmail(data.email);
    if (!user) return { error: "No account found with that email." };

    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) return { error: "Incorrect password. Try again." };

    rateLimitReset(`login:${data.email}`);
    await createSession(user.id);
    return { user: toPublicUser(user) };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true };
});

/* ---- Email verification ---- */

const tokenSchema = z.object({ token: z.string().min(1) });

export const verifyEmailFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const repo = await getRepo();
    const t = await repo.verificationTokens.get(data.token);
    if (!t || t.kind !== "verify_email" || t.usedAt || new Date(t.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: "This verification link is invalid or has expired." };
    }
    await repo.users.update(t.userId, { emailVerified: true });
    await repo.verificationTokens.update(t.id, { usedAt: new Date() });
    return { ok: true };
  });

export const resendVerificationFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (user.emailVerified) return { ok: true, already: true };
  const rl = rateLimit(`verify:${user.id}`, 3, 15 * 60 * 1000);
  if (!rl.allowed) return { ok: false, error: "Please wait before requesting another email." };
  const token = await issueToken(user.id, "verify_email", 24 * 60 * 60 * 1000);
  const link = `${baseUrl()}/verify-email?token=${token.id}`;
  const email = await sendEmail({
    to: user.email,
    subject: "Verify your finAI-Buddy email",
    text: `Confirm your email:\n${link}`,
    link,
  });
  return { ok: true, devLink: email.devLink };
});

/* ---- Password reset ---- */

const requestResetSchema = z.object({ email: z.string().trim().toLowerCase().email() });

export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => requestResetSchema.parse(data))
  .handler(async ({ data }) => {
    const rl = rateLimit(`reset:${data.email}`, 3, 60 * 60 * 1000);
    if (!rl.allowed) return { ok: true }; // don't leak; silently rate-limit
    const repo = await getRepo();
    const user = await repo.users.getByEmail(data.email);
    // Always return ok so we don't reveal whether the email exists.
    if (!user) return { ok: true };
    const token = await issueToken(user.id, "password_reset", 60 * 60 * 1000);
    const link = `${baseUrl()}/reset-password?token=${token.id}`;
    const email = await sendEmail({
      to: data.email,
      subject: "Reset your finAI-Buddy password",
      text: `Reset your password (valid 1 hour):\n${link}`,
      link,
    });
    return { ok: true, devLink: email.devLink };
  });

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => resetSchema.parse(data))
  .handler(async ({ data }) => {
    const repo = await getRepo();
    const t = await repo.verificationTokens.get(data.token);
    if (!t || t.kind !== "password_reset" || t.usedAt || new Date(t.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: "This reset link is invalid or has expired." };
    }
    await repo.users.update(t.userId, { passwordHash: await hashPassword(data.password) });
    await repo.verificationTokens.update(t.id, { usedAt: new Date() });
    await repo.sessions.deleteByUser(t.userId); // invalidate all existing sessions
    return { ok: true };
  });
