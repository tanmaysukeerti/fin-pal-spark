import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { getRepo } from "../../db/repo";
import { newSessionToken } from "./password";
import type { User } from "../../db/schema";

export const SESSION_COOKIE = "finai_session";
const SESSION_DAYS = 30;

function sessionSecret(): string {
  return (
    (typeof process !== "undefined" && process.env.SESSION_SECRET) ||
    "finai-buddy-dev-secret-change-me"
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** HMAC-SHA256 the token so a tampered cookie is rejected before any DB hit. */
async function hmac(token: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(token)));
}

async function signToken(token: string): Promise<string> {
  return `${token}.${await hmac(token)}`;
}

/** Verify a signed cookie value and return the raw token, or null if tampered. */
async function unsignToken(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const token = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = await hmac(token);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? token : null;
}

/** User shape safe to expose to the client (no password hash). */
export type PublicUser = Omit<User, "passwordHash">;

export function toPublicUser(user: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = user;
  return rest;
}

/** Resolve the currently authenticated user from the signed session cookie. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = await unsignToken(getCookie(SESSION_COOKIE));
  if (!token) return null;

  const repo = await getRepo();
  const session = await repo.sessions.get(token);
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await repo.sessions.remove(token);
    deleteCookie(SESSION_COOKIE, { path: "/" });
    return null;
  }

  const user = await repo.users.get(session.userId);
  if (!user) return null;
  return toPublicUser(user);
}

/** Like getCurrentUser but throws when unauthenticated (for protected server fns). */
export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

/** Create a session for `userId` and set the signed httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const repo = await getRepo();
  const token = newSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await repo.sessions.create({ id: token, userId, expiresAt, createdAt: now });
  setCookie(SESSION_COOKIE, await signToken(token), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure: typeof process !== "undefined" && process.env.NODE_ENV === "production",
  });
}

/** Destroy the current session (logout). */
export async function destroySession(): Promise<void> {
  const token = await unsignToken(getCookie(SESSION_COOKIE));
  if (token) {
    const repo = await getRepo();
    await repo.sessions.remove(token);
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
}
