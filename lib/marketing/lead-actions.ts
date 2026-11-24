"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { deleteLead, importLeads, markLeadContacted, setLeadNotes, setLeadStage, type LeadImportSummary } from "@/lib/marketing/leads";
import { leadImportPayload, leadUpdateInput } from "@/lib/marketing/leads-rules";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";
import { err, ok, type Result } from "@/lib/result";

// Outreach lead actions (D-120). Each one: requireAdmin() (sign-in page for anyone else), Zod-checked
// input, a rate limit, the change. Imports and deletes also go to the audit log (counts only).

const GROWTH_PATH = "/admin/growth";
const SLOW_DOWN = "Slow down a little, then try again.";
const FAILED = "Couldn't save that. Check your connection and try again.";

const actorOf = (admin: { username: string }) => `admin:${admin.username}`;

/** One part of a CSV import (up to 1,000 rows). */
export async function importLeadsAction(raw: unknown): Promise<Result<LeadImportSummary>> {
  const admin = await requireAdmin();
  const parsed = leadImportPayload.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the file and try again.");
  if (!(await takeRateLimit(rateLimitKey("admin-lead-import", admin.id), 60, 10))) return err(SLOW_DOWN);
  try {
    const summary = await importLeads(parsed.data, actorOf(admin));
    await recordAudit({
      actorId: admin.id,
      action: "admin.leads_imported",
      meta: { added: summary.added, existing: summary.existing, suppressed: summary.suppressed, invalid: summary.invalid },
      ipHash: await getClientIpHash().catch(() => null),
    });
    revalidatePath(GROWTH_PATH);
    return ok(summary);
  } catch (error) {
    logger.error("leads.import_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't import this part. Nothing after it was sent; try the file again (leads already added are skipped).");
  }
}

/** Change a lead's stage or notes, or note that they were contacted now. */
export async function updateLeadAction(raw: unknown): Promise<Result<{ message: string }>> {
  const admin = await requireAdmin();
  const parsed = leadUpdateInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the form and try again.");
  if (!(await takeRateLimit(rateLimitKey("admin-lead-update", admin.id), 120, 10))) return err(SLOW_DOWN);
  const data = parsed.data;
  try {
    let found: boolean;
    let message: string;
    switch (data.action) {
      case "stage":
        found = await setLeadStage(data.leadId, data.stage, actorOf(admin));
        message = "Stage saved.";
        break;
      case "notes":
        found = await setLeadNotes(data.leadId, data.notes, actorOf(admin));
        message = "Notes saved.";
        break;
      case "contacted":
        found = await markLeadContacted(data.leadId, actorOf(admin));
        message = "Marked as contacted today.";
        break;
    }
    if (!found) return err(data.action === "contacted" ? "This lead was not found, or is marked do not contact." : "This lead was not found.");
    revalidatePath(GROWTH_PATH);
    revalidatePath(`${GROWTH_PATH}/${data.leadId}`);
    return ok({ message });
  } catch (error) {
    logger.error("leads.update_failed", { name: error instanceof Error ? error.name : undefined });
    return err(FAILED);
  }
}

/** Delete a lead for good; the handle is blocked from future imports. */
export async function deleteLeadAction(raw: unknown): Promise<Result<{ message: string }>> {
  const admin = await requireAdmin();
  const parsed = z.object({ leadId: z.uuid() }).safeParse(raw);
  if (!parsed.success) return err("This lead was not found.");
  if (!(await takeRateLimit(rateLimitKey("admin-lead-update", admin.id), 120, 10))) return err(SLOW_DOWN);
  try {
    if (!(await deleteLead(parsed.data.leadId))) return err("This lead was not found.");
    await recordAudit({ actorId: admin.id, action: "admin.lead_deleted", ipHash: await getClientIpHash().catch(() => null) });
    revalidatePath(GROWTH_PATH);
    return ok({ message: "Lead deleted." });
  } catch (error) {
    logger.error("leads.delete_failed", { name: error instanceof Error ? error.name : undefined });
    return err(FAILED);
  }
}
