"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { billingConfigured } from "@/lib/payments/billing";
import { importPlanInvoices } from "@/lib/plans/billing-sync";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";
import { err, ok, type Result } from "@/lib/result";

/**
 * Imports paid plan invoices from our Stripe account (D-116), for payments made before they were
 * saved from the webhook. It only reads Stripe; invoices already saved are skipped, so it is safe to
 * run again. Admin only, rate limited, audited.
 */
export async function importPlanInvoicesAction(): Promise<Result<{ seen: number; added: number }>> {
  const admin = await requireAdmin();
  if (!billingConfigured()) return err("Stripe isn't set up on this server.");
  if (!(await takeRateLimit(rateLimitKey("admin-billing-import", admin.id), 3, 10))) return err("Wait a few minutes before importing again.");
  try {
    const result = await importPlanInvoices();
    await recordAudit({ actorId: admin.id, action: "admin.billing_imported", meta: { seen: result.seen, added: result.added }, ipHash: await getClientIpHash().catch(() => null) });
    revalidatePath("/admin/billing");
    return ok(result);
  } catch (error) {
    logger.error("admin.billing_import_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't read invoices from Stripe. Try again.");
  }
}
