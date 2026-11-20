"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ADMIN_PASSWORD_MIN, changeAdminPassword, checkAdminLogin, createAdminSession, deleteAdminSession } from "@/lib/admin/accounts";
import { currentAdmin, requireAdmin } from "@/lib/admin/guard";
import { ADMIN_COOKIE } from "@/lib/admin/session";
import { recordAudit } from "@/lib/audit/log";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";

// Admin sign-in, sign-out and password change (D-108). Accounts and sessions are in MongoDB. The
// sign-in answer never says which part was wrong; tries are limited per network address; sign-ins,
// failures (no username kept), sign-outs and password changes go to the audit log.

export type AdminLoginState = { error: string } | null;

const input = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(200) });
const WRONG = "Wrong username or password.";
const LOGIN_LIMIT = { max: 5, windowMinutes: 15 } as const;

export async function signInAdmin(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const parsed = input.safeParse({ username: formData.get("username") ?? "", password: formData.get("password") ?? "" });
  if (!parsed.success) return { error: WRONG };

  const ipHash = await getClientIpHash().catch(() => null);
  if (!(await takeRateLimit(rateLimitKey("admin-login:ip", ipHash ?? "unknown"), LOGIN_LIMIT.max, LOGIN_LIMIT.windowMinutes))) {
    return { error: "Too many tries. Wait 15 minutes, then try again." };
  }

  const admin = await checkAdminLogin(parsed.data.username, parsed.data.password);
  if (!admin) {
    await recordAudit({ actorId: "admin:unknown", action: "admin.sign_in_failed", ipHash });
    return { error: WRONG };
  }

  const session = await createAdminSession(admin.id, ipHash);
  const store = await cookies();
  store.set(ADMIN_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires: session.expiresAt });
  await recordAudit({ actorId: `admin:${admin.username}`, action: "admin.signed_in", ipHash });
  redirect("/admin");
}

/** Ends this session in the database, so the cookie no longer works anywhere. */
export async function signOutAdmin(): Promise<void> {
  const admin = await currentAdmin();
  const store = await cookies();
  await deleteAdminSession(store.get(ADMIN_COOKIE)?.value);
  store.delete(ADMIN_COOKIE);
  if (admin) await recordAudit({ actorId: `admin:${admin.username}`, action: "admin.signed_out", ipHash: await getClientIpHash().catch(() => null) });
  redirect("/admin/login");
}

export type ChangePasswordState = { ok: boolean; message: string } | null;

const passwordInput = z.object({ current: z.string().min(1).max(200), next: z.string().min(ADMIN_PASSWORD_MIN, { error: `Use at least ${ADMIN_PASSWORD_MIN} characters.` }).max(200), confirm: z.string().max(200) });

/** Changes the signed-in admin's password and signs out their other sessions. */
export async function changeAdminPasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const admin = await requireAdmin();
  const parsed = passwordInput.safeParse({ current: formData.get("current") ?? "", next: formData.get("next") ?? "", confirm: formData.get("confirm") ?? "" });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  if (parsed.data.next !== parsed.data.confirm) return { ok: false, message: "The new passwords are different." };
  const ipHash = await getClientIpHash().catch(() => null);
  if (!(await takeRateLimit(rateLimitKey("admin-password", admin.id), 5, 15))) return { ok: false, message: "Too many tries. Wait 15 minutes, then try again." };
  const store = await cookies();
  const problem = await changeAdminPassword(admin.id, parsed.data.current, parsed.data.next, store.get(ADMIN_COOKIE)?.value);
  if (problem) return { ok: false, message: problem };
  await recordAudit({ actorId: `admin:${admin.username}`, action: "admin.password_changed", ipHash });
  return { ok: true, message: "Password changed. Your other admin sessions are signed out." };
}
