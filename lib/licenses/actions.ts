"use server";

import { revalidatePath } from "next/cache";

import { requireCreator } from "@/lib/auth/guards";
import { setLicenseRevoked, setProductLicense } from "@/lib/licenses/queries";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

// License key settings for the signed-in creator (D-114). Every write filters by the session's store.

async function allowed(ownerId: string): Promise<boolean> {
  return takeRateLimit(rateLimitKey("license-write:owner", ownerId), 60, 10);
}

/** Turns license keys on or off for one of the creator's digital products. */
export async function saveProductLicenseAction(productId: unknown, enabled: unknown): Promise<Result<{ enabled: boolean }>> {
  const { user, store } = await requireCreator("/dashboard/products");
  if (typeof productId !== "string" || !isUuid(productId) || typeof enabled !== "boolean") return err("We couldn't find that product.");
  if (!(await allowed(user.id))) return err("Slow down a little, then try again.");
  try {
    if (!(await setProductLicense(store.id, productId, enabled))) return err("We couldn't find that product.");
  } catch (error) {
    logger.error("licenses.setting_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
  revalidatePath(`/dashboard/products/${productId}`);
  return ok({ enabled });
}

/** Revokes (the key stops verifying) or restores the key of one of the creator's orders. */
export async function setOrderLicenseRevokedAction(orderId: unknown, revoked: unknown): Promise<Result<{ revoked: boolean }>> {
  const { user, store } = await requireCreator("/dashboard/orders");
  if (typeof orderId !== "string" || !isUuid(orderId) || typeof revoked !== "boolean") return err("We couldn't find that key.");
  if (!(await allowed(user.id))) return err("Slow down a little, then try again.");
  try {
    if (!(await setLicenseRevoked(store.id, orderId, revoked))) return err("We couldn't find that key.");
  } catch (error) {
    logger.error("licenses.revoke_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
  revalidatePath("/dashboard/orders");
  return ok({ revoked });
}
