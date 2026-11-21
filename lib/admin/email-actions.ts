"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/audit/log";
import { collections } from "@/lib/db/collections";
import { logger } from "@/lib/logger";
import { sendOrderConfirmation } from "@/lib/orders/confirmation";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";
import { err, ok, type Result } from "@/lib/result";

const DAYS = 14;
const MAX = 200;

/**
 * Sends again the order access emails that failed in the last 14 days (D-037), once the email setup
 * is fixed. Each goes through sendOrderConfirmation, which retries only a failed one and can never
 * email a buyer twice. Admin only, rate limited, audited.
 */
export async function retryFailedOrderEmailsAction(): Promise<Result<{ tried: number; sent: number }>> {
  const admin = await requireAdmin();
  if (!(await takeRateLimit(rateLimitKey("admin-email-retry", admin.id), 3, 10))) return err("Wait a few minutes before trying again.");
  try {
    const { emailOutbox } = await collections();
    const failed = await emailOutbox
      .find({ kind: "order-confirmation", status: "failed", createdAt: { $gte: new Date(Date.now() - DAYS * 86_400_000) } }, { projection: { orderId: 1 } })
      .limit(MAX)
      .toArray();
    let sent = 0;
    for (const row of failed) if ((await sendOrderConfirmation(row.orderId)) === "sent") sent += 1;
    await recordAudit({ actorId: admin.id, action: "admin.emails_retried", meta: { tried: failed.length, sent }, ipHash: await getClientIpHash().catch(() => null) });
    revalidatePath("/admin/health");
    return ok({ tried: failed.length, sent });
  } catch (error) {
    logger.error("admin.email_retry_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't send the emails again. Try again.");
  }
}
