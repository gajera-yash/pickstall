import "server-only";

import { notFound } from "next/navigation";

import { getCurrentUser, type AuthUser } from "@/lib/auth/guards";
import { serverEnv } from "@/lib/env.server";

// Platform admin access (D-104). Only signed-in users whose email is in ADMIN_EMAILS (server-only)
// may open /admin; everyone else gets a plain 404, so the admin area is not even visible.

/** The allowed admin emails, lower case. Empty when ADMIN_EMAILS is not set. */
export function adminEmails(raw: string | undefined = serverEnv.ADMIN_EMAILS): Set<string> {
  return new Set((raw ?? "").split(",").map((value) => value.trim().toLowerCase()).filter((value) => value.includes("@")));
}

export function isAdminEmail(email: string | null | undefined, raw?: string): boolean {
  return Boolean(email) && adminEmails(raw).has((email as string).trim().toLowerCase());
}

/** The signed-in admin, or a 404 for anyone else (signed out included). */
export async function requireAdmin(): Promise<AuthUser & { email: string }> {
  const user = await getCurrentUser();
  if (!user?.email || !isAdminEmail(user.email)) notFound();
  return { ...user, email: user.email };
}
