import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { findSessionAdmin } from "@/lib/admin/accounts";
import { ADMIN_COOKIE } from "@/lib/admin/session";

// Platform admin access (D-108): an admin session stored in MongoDB, from /admin/login (username and
// password of an admin account, apart from creator accounts). Without a live session every admin
// page sends the visitor to the sign-in page.

export type AdminUser = { id: string; username: string };

/** The signed-in admin from the session cookie, or null. */
export async function currentAdmin(): Promise<AdminUser | null> {
  const store = await cookies();
  return findSessionAdmin(store.get(ADMIN_COOKIE)?.value);
}

/** The signed-in admin, or a redirect to the admin sign-in page. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
