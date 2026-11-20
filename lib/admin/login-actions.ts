"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { adminLoginConfigured, checkAdminLogin, createAdminSession, deleteAdminSession } from "@/lib/admin/accounts";
import { currentAdmin } from "@/lib/admin/guard";
import { ADMIN_COOKIE } from "@/lib/admin/session";
import { recordAudit } from "@/lib/audit/log";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";

// Admin sign-in and sign-out (D-109): credentials from the environment, sessions in MongoDB. The
// answer never says which part was wrong; tries are limited per network address; sign-ins,
// failures (no username kept) and sign-outs go to the audit log.

export type AdminLoginState = { error: string } | null;

const input = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(200) });
const WRONG = "Wrong username or password.";
const LOGIN_LIMIT = { max: 5, windowMinutes: 15 } as const;

export async function signInAdmin(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  if (!adminLoginConfigured()) return { error: "Admin sign-in isn't set up on this server." };
  const parsed = input.safeParse({ username: formData.get("username") ?? "", password: formData.get("password") ?? "" });
  if (!parsed.success) return { error: WRONG };

  const ipHash = await getClientIpHash().catch(() => null);
  if (!(await takeRateLimit(rateLimitKey("admin-login:ip", ipHash ?? "unknown"), LOGIN_LIMIT.max, LOGIN_LIMIT.windowMinutes))) {
    return { error: "Too many tries. Wait 15 minutes, then try again." };
  }

  const admin = checkAdminLogin(parsed.data.username, parsed.data.password);
  if (!admin) {
    await recordAudit({ actorId: "admin:unknown", action: "admin.sign_in_failed", ipHash });
    return { error: WRONG };
  }

  const session = await createAdminSession(admin.id, ipHash);
  const store = await cookies();
  store.set(ADMIN_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires: session.expiresAt });
  await recordAudit({ actorId: admin.id, action: "admin.signed_in", ipHash });
  redirect("/admin");
}

/** Ends this session in the database, so the cookie no longer works anywhere. */
export async function signOutAdmin(): Promise<void> {
  const admin = await currentAdmin();
  const store = await cookies();
  await deleteAdminSession(store.get(ADMIN_COOKIE)?.value);
  store.delete(ADMIN_COOKIE);
  if (admin) await recordAudit({ actorId: admin.id, action: "admin.signed_out", ipHash: await getClientIpHash().catch(() => null) });
  redirect("/admin/login");
}
