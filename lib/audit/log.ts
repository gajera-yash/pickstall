import "server-only";

import { randomUUID } from "node:crypto";

import { collections } from "@/lib/db/collections";
import { logger } from "@/lib/logger";

// Audit log (PRD 5.5 item 7, D-075): who did which sensitive thing, and when. It helps a creator
// notice activity they don't recognise, and us to investigate abuse. Records carry ids and a hashed
// IP only (no emails, no tokens) and expire after AUDIT_RETENTION_DAYS. Writing never breaks the
// action it records.

export const AUDIT_ACTIONS = [
  "auth.signed_in",
  "security.signed_out_other_devices",
  "store.published",
  "store.unpublished",
  "store.username_changed",
  "stripe.connected",
  "stripe.disconnected",
  "paypal.connected",
  "paypal.disconnected",
  "plan.checkout_started",
  "plan.subscribed",
  "plan.changed",
  "product.deleted",
  "account.data_exported",
  "account.deleted",
  // Platform admin actions (D-105): actorId is the admin, storeId the store acted on.
  "admin.trial_extended",
  "admin.founding_granted",
  "admin.store_suspended",
  "admin.store_restored",
  "admin.product_unpublished",
  "admin.broadcasts_blocked",
  "admin.broadcasts_unblocked",
  "admin.signed_in",
  "admin.sign_in_failed",
  "admin.signed_out",
  "admin.password_changed",
  "admin.billing_imported",
  "admin.leads_imported",
  "admin.lead_deleted",
  "admin.leads_exported",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_RETENTION_DAYS = 400;

type AuditMeta = Record<string, string | number | boolean>;

/** Saves one audit record. Never throws: a failed write is logged and the action goes on. */
export async function recordAudit(entry: { actorId: string; action: AuditAction; storeId?: string | null; meta?: AuditMeta; ipHash?: string | null }): Promise<void> {
  try {
    const { auditLogs } = await collections();
    await auditLogs.insertOne({
      _id: randomUUID(),
      actorId: entry.actorId,
      storeId: entry.storeId ?? null,
      action: entry.action,
      meta: entry.meta ?? {},
      ipHash: entry.ipHash ?? null,
      at: new Date(),
    });
  } catch (error) {
    logger.warn("audit.write_failed", { action: entry.action, name: error instanceof Error ? error.name : undefined });
  }
}

export type AuditEntry = { id: string; action: AuditAction; meta: AuditMeta; at: Date };

/** The signed-in person's own recent activity, newest first. `ownerId` comes from the session. */
export async function listOwnAudit(ownerId: string, limit = 20): Promise<AuditEntry[]> {
  const { auditLogs } = await collections();
  const docs = await auditLogs.find({ actorId: ownerId }, { projection: { action: 1, meta: 1, at: 1 } }).sort({ at: -1 }).limit(limit).toArray();
  return docs.map((doc) => ({ id: doc._id, action: doc.action, meta: doc.meta, at: doc.at }));
}
