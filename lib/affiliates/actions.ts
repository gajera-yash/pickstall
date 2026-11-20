"use server";

import { revalidatePath } from "next/cache";

import { createAffiliate, recordAffiliatePayout, setAffiliateActive } from "@/lib/affiliates/queries";
import { affiliateInput, payoutInputFor } from "@/lib/affiliates/rules";
import { requireCreator } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

// Affiliate actions for the signed-in creator (D-113). Tracking only: recording a payout writes a
// note of a payment the creator made elsewhere; no money moves through the platform.

const PATH = "/dashboard/marketing/affiliates";
const NOT_FOUND = "We couldn't find that affiliate.";

async function allowed(ownerId: string): Promise<boolean> {
  return takeRateLimit(rateLimitKey("affiliate-write:owner", ownerId), 30, 10);
}

function firstIssue(error: { issues: { message: string; path: PropertyKey[] }[] }) {
  const issue = error.issues[0];
  const field = issue?.path[0];
  return err(issue?.message ?? "Check the form and try again.", typeof field === "string" ? field : undefined);
}

/** Adds an affiliate to the session owner's store. */
export async function createAffiliateAction(input: unknown): Promise<Result<{ id: string }>> {
  const { user, store } = await requireCreator(PATH);
  const parsed = affiliateInput.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  if (!(await allowed(user.id))) return err("Slow down a little, then try again.");
  try {
    const result = await createAffiliate(store.id, parsed.data);
    if (result === "taken") return err("You already have an affiliate with this code.", "code");
    if (result === "limit") return err("You have reached the limit of 50 affiliates.");
    revalidatePath(PATH);
    return ok(result);
  } catch (error) {
    logger.error("affiliates.create_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save the affiliate. Try again.");
  }
}

/** Pauses (links stop counting) or resumes an affiliate of the session owner's store. */
export async function setAffiliateActiveAction(affiliateId: unknown, active: unknown): Promise<Result<{ active: boolean }>> {
  const { store } = await requireCreator(PATH);
  if (typeof affiliateId !== "string" || !isUuid(affiliateId) || typeof active !== "boolean") return err(NOT_FOUND);
  try {
    if (!(await setAffiliateActive(store.id, affiliateId, active))) return err(NOT_FOUND);
  } catch (error) {
    logger.error("affiliates.toggle_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
  revalidatePath(PATH);
  return ok({ active });
}

/** Notes a payment the creator made to an affiliate outside the platform, in the store's currency. */
export async function recordAffiliatePayoutAction(affiliateId: unknown, input: unknown): Promise<Result<{ amountCents: number }>> {
  const { user, store } = await requireCreator(PATH);
  if (typeof affiliateId !== "string" || !isUuid(affiliateId)) return err(NOT_FOUND);
  const parsed = payoutInputFor(store.currency).safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  if (!(await allowed(user.id))) return err("Slow down a little, then try again.");
  try {
    const saved = await recordAffiliatePayout(store.id, affiliateId, { amountCents: parsed.data.amount, currency: store.currency, note: parsed.data.note });
    if (!saved) return err(NOT_FOUND);
  } catch (error) {
    logger.error("affiliates.payout_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save the payment. Try again.");
  }
  revalidatePath(PATH);
  return ok({ amountCents: parsed.data.amount });
}
