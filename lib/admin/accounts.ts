import "server-only";

import { collections } from "@/lib/db/collections";
import { ADMIN_SESSION_HOURS, hashPassword, isSessionToken, newSessionToken, sessionTokenHash, verifyPassword } from "@/lib/admin/session";

// Platform admin accounts and sessions in MongoDB (D-108). Only called from lib/admin/* after the
// right checks: sign-in (username and password), the guard (session cookie) and change password.

export type AdminIdentity = { id: string; username: string };

/** Compared against when the username does not exist, so a wrong username takes as long as a wrong password. */
const DUMMY_HASH = hashPassword("no-such-admin-password", Buffer.alloc(16, 7));

/** The admin with this username and password, or null. Always runs one scrypt check. */
export async function checkAdminLogin(username: string, password: string): Promise<AdminIdentity | null> {
  const { adminUsers } = await collections();
  const admin = await adminUsers.findOne({ usernameKey: username.trim().toLowerCase() }, { projection: { username: 1, passwordHash: 1 } });
  const ok = verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);
  return admin && ok ? { id: admin._id, username: admin.username } : null;
}

/** Starts a session for the admin and returns the cookie token (the database keeps its hash). */
export async function createAdminSession(adminId: string, ipHash: string | null, now: Date = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const { adminSessions, adminUsers } = await collections();
  const token = newSessionToken();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_HOURS * 60 * 60 * 1000);
  await adminSessions.insertOne({ _id: sessionTokenHash(token), adminId, ipHash, createdAt: now, expiresAt });
  await adminUsers.updateOne({ _id: adminId }, { $set: { lastLoginAt: now } });
  return { token, expiresAt };
}

/** The admin of a live session token, or null (unknown, expired, or the admin no longer exists). */
export async function findSessionAdmin(token: string | undefined, now: Date = new Date()): Promise<AdminIdentity | null> {
  if (!isSessionToken(token)) return null;
  const { adminSessions, adminUsers } = await collections();
  const session = await adminSessions.findOne({ _id: sessionTokenHash(token), expiresAt: { $gt: now } }, { projection: { adminId: 1 } });
  if (!session) return null;
  const admin = await adminUsers.findOne({ _id: session.adminId }, { projection: { username: 1 } });
  return admin ? { id: admin._id, username: admin.username } : null;
}

/** Ends one session (sign out). */
export async function deleteAdminSession(token: string | undefined): Promise<void> {
  if (!isSessionToken(token)) return;
  const { adminSessions } = await collections();
  await adminSessions.deleteOne({ _id: sessionTokenHash(token) });
}

export const ADMIN_PASSWORD_MIN = 12;

/**
 * Changes the admin's password after checking the current one, then ends all their other sessions
 * (the one making the change stays). Returns why it failed, or null.
 */
export async function changeAdminPassword(adminId: string, current: string, next: string, keepToken: string | undefined, now: Date = new Date()): Promise<string | null> {
  const { adminUsers, adminSessions } = await collections();
  const admin = await adminUsers.findOne({ _id: adminId }, { projection: { passwordHash: 1 } });
  if (!admin || !verifyPassword(current, admin.passwordHash)) return "Your current password is not right.";
  if (next.length < ADMIN_PASSWORD_MIN) return `Use at least ${ADMIN_PASSWORD_MIN} characters.`;
  if (next === current) return "Choose a new password, not the same one.";
  await adminUsers.updateOne({ _id: adminId }, { $set: { passwordHash: hashPassword(next), passwordChangedAt: now, updatedAt: now } });
  const keep = isSessionToken(keepToken) ? sessionTokenHash(keepToken) : null;
  await adminSessions.deleteMany({ adminId, ...(keep ? { _id: { $ne: keep } } : {}) });
  return null;
}
