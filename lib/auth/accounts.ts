import "server-only";

import { canonicalEmail } from "@/lib/auth/email-rules";
import { collections } from "@/lib/db/collections";
import { getDb } from "@/lib/db/mongo";

/**
 * Does this email already have an account (D-071)? True for the exact email in Better Auth's `user`
 * collection (read only; app code never writes there), or for any store whose owner has the same
 * inbox (`maya+2@gmail.com` when `maya@gmail.com` owns one). The signup form says so on purpose
 * (founder decision); the check is rate-limited by the caller so it cannot be used to list emails.
 */
export async function emailHasAccount(email: string): Promise<boolean> {
  const db = await getDb();
  const { stores } = await collections();
  const key = canonicalEmail(email);
  const [user, store] = await Promise.all([
    db.collection("user").findOne({ email: email.trim().toLowerCase() }, { projection: { _id: 1 } }),
    key ? stores.findOne({ ownerEmailKey: key }, { projection: { _id: 1 } }) : null,
  ]);
  return user !== null || store !== null;
}
