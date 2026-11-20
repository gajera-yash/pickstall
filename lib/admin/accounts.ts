import "server-only";

import { createHash } from "node:crypto";

import { collections } from "@/lib/db/collections";
import { serverEnv } from "@/lib/env.server";
import { ADMIN_SESSION_HOURS, isSessionToken, newSessionToken, safeEqual, sessionTokenHash } from "@/lib/admin/session";

// Platform admin sign-in (D-109): the username and password come from the server environment
// (ADMIN_USERNAME, ADMIN_PASSWORD, set in Vercel); sessions are stored in MongoDB (`adminSessions`).
// Each session remembers a fingerprint of the credentials it was made with, so changing the username
// or password in the environment signs every admin out.

export type AdminIdentity = { id: string; username: string };

/** True when admin sign-in is set up on this server. */
export function adminLoginConfigured(): boolean {
  return Boolean(serverEnv.ADMIN_USERNAME && serverEnv.ADMIN_PASSWORD);
}

/** A short, one-way fingerprint of the current credentials (never the password itself). */
function credentialsFingerprint(): string {
  return createHash("sha256").update(`${serverEnv.ADMIN_USERNAME}\u0000${serverEnv.ADMIN_PASSWORD}`).digest("hex").slice(0, 32);
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * The admin, when the username (case-insensitive) and password match the environment. Both are
 * compared in constant time, through their SHA-256, so length and timing reveal nothing.
 */
export function checkAdminLogin(username: string, password: string): AdminIdentity | null {
  if (!adminLoginConfigured()) return null;
  const configured = serverEnv.ADMIN_USERNAME as string;
  const userOk = safeEqual(digest(username.trim().toLowerCase()), digest(configured.trim().toLowerCase()));
  const passwordOk = safeEqual(digest(password), digest(serverEnv.ADMIN_PASSWORD as string));
  return userOk && passwordOk ? { id: `admin:${configured}`, username: configured } : null;
}

/** Starts a session and returns the cookie token (the database keeps its hash). */
export async function createAdminSession(adminId: string, ipHash: string | null, now: Date = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const { adminSessions } = await collections();
  const token = newSessionToken();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_HOURS * 60 * 60 * 1000);
  await adminSessions.insertOne({ _id: sessionTokenHash(token), adminId, credentials: credentialsFingerprint(), ipHash, createdAt: now, expiresAt });
  return { token, expiresAt };
}

/** The admin of a live session made with the current credentials, or null. */
export async function findSessionAdmin(token: string | undefined, now: Date = new Date()): Promise<AdminIdentity | null> {
  if (!adminLoginConfigured() || !isSessionToken(token)) return null;
  const { adminSessions } = await collections();
  const session = await adminSessions.findOne({ _id: sessionTokenHash(token), expiresAt: { $gt: now } }, { projection: { adminId: 1, credentials: 1 } });
  if (!session || session.credentials !== credentialsFingerprint()) return null;
  const username = serverEnv.ADMIN_USERNAME as string;
  return session.adminId === `admin:${username}` ? { id: session.adminId, username } : null;
}

/** Ends one session (sign out). */
export async function deleteAdminSession(token: string | undefined): Promise<void> {
  if (!isSessionToken(token)) return;
  const { adminSessions } = await collections();
  await adminSessions.deleteOne({ _id: sessionTokenHash(token) });
}
