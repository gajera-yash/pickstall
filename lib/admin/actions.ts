"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/guard";
import { extendTrial, grantFounding, setBroadcastsBlocked, setStoreSuspended, unpublishProductAsAdmin } from "@/lib/admin/mutations";
import { recordAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { cleanText } from "@/lib/products/text";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";
import { err, ok, type Result } from "@/lib/result";

// Platform admin actions (D-105). Each one: requireAdmin() (404 for anyone else), Zod-checked input,
// a rate limit, the change, then an audit record (admin id, store id, a short reason; no emails).

const id = z.uuid();
const reason = z
  .string()
  .transform((value) => cleanText(value).replace(/\s+/g, " ").slice(0, 200))
  .pipe(z.string().min(3, { error: "Write a short reason (it is kept in the audit log)." }));

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("extend_trial"), storeId: id, days: z.number().int().min(1).max(90), reason }),
  z.object({ action: z.literal("grant_founding"), storeId: id, months: z.number().int().min(1).max(12), reason }),
  z.object({ action: z.literal("suspend"), storeId: id, reason }),
  z.object({ action: z.literal("restore"), storeId: id, reason }),
  z.object({ action: z.literal("block_broadcasts"), storeId: id, reason }),
  z.object({ action: z.literal("unblock_broadcasts"), storeId: id, reason }),
  z.object({ action: z.literal("unpublish_product"), productId: id, reason }),
]);

export type AdminActionInput = z.input<typeof input>;

export async function runAdminAction(raw: unknown): Promise<Result<{ message: string }>> {
  const admin = await requireAdmin();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the form and try again.");
  if (!(await takeRateLimit(rateLimitKey("admin-action", admin.id), 60, 10))) return err("Slow down a little, then try again.");
  const ipHash = await getClientIpHash().catch(() => null);
  const data = parsed.data;

  try {
    let storeId: string | null;
    let message: string;
    switch (data.action) {
      case "extend_trial": {
        const until = await extendTrial(data.storeId, data.days);
        if (!until) return err("Store not found.");
        storeId = data.storeId;
        message = `Trial now ends on ${until.toISOString().slice(0, 10)}.`;
        await recordAudit({ actorId: admin.id, action: "admin.trial_extended", storeId, meta: { days: data.days, reason: data.reason }, ipHash });
        break;
      }
      case "grant_founding": {
        const until = await grantFounding(data.storeId, data.months);
        if (!until) return err("Store not found.");
        storeId = data.storeId;
        message = `Founding until ${until.toISOString().slice(0, 10)}.`;
        await recordAudit({ actorId: admin.id, action: "admin.founding_granted", storeId, meta: { months: data.months, reason: data.reason }, ipHash });
        break;
      }
      case "suspend":
      case "restore": {
        const suspend = data.action === "suspend";
        if (!(await setStoreSuspended(data.storeId, suspend, suspend ? data.reason : null))) return err("Store not found.");
        storeId = data.storeId;
        message = suspend ? "Store suspended." : "Store restored.";
        await recordAudit({ actorId: admin.id, action: suspend ? "admin.store_suspended" : "admin.store_restored", storeId, meta: { reason: data.reason }, ipHash });
        break;
      }
      case "block_broadcasts":
      case "unblock_broadcasts": {
        const block = data.action === "block_broadcasts";
        if (!(await setBroadcastsBlocked(data.storeId, block))) return err("Store not found.");
        storeId = data.storeId;
        message = block ? "Broadcasts turned off." : "Broadcasts allowed again.";
        await recordAudit({ actorId: admin.id, action: block ? "admin.broadcasts_blocked" : "admin.broadcasts_unblocked", storeId, meta: { reason: data.reason }, ipHash });
        break;
      }
      case "unpublish_product": {
        storeId = await unpublishProductAsAdmin(data.productId);
        if (!storeId) return err("That product isn't published.");
        message = "Product unpublished.";
        await recordAudit({ actorId: admin.id, action: "admin.product_unpublished", storeId, meta: { productId: data.productId, reason: data.reason }, ipHash });
        break;
      }
    }
    revalidatePath("/admin", "layout");
    if (storeId) revalidatePath(`/admin/creators/${storeId}`);
    return ok({ message });
  } catch (error) {
    logger.error("admin.action_failed", { action: data.action, name: error instanceof Error ? error.name : undefined });
    return err("Couldn't do that. Try again.");
  }
}
