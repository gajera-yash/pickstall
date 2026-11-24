"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/guard";
import { logger } from "@/lib/logger";
import { createDraft, markFollowUpSent, saveGrowthSettings } from "@/lib/marketing/drafts";
import { growthSettingsInput } from "@/lib/marketing/growth-settings-rules";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

// DM draft and follow-up actions (D-121). Each one: requireAdmin(), Zod-checked input, a rate
// limit, the change. Drafts also stop at the daily draft limit in Growth settings.

const GROWTH_PATH = "/admin/growth";
const SLOW_DOWN = "Slow down a little, then try again.";
const actorOf = (admin: { username: string }) => `admin:${admin.username}`;
const leadInput = z.object({ leadId: z.uuid() });

export type DraftView = { firstMessage: string; followUp: string; writer: "template" | "groq"; model: string | null; note: string | null };

/** Writes a new draft (first message and follow-up) for one lead. */
export async function writeDraftAction(raw: unknown): Promise<Result<DraftView>> {
  const admin = await requireAdmin();
  const parsed = leadInput.safeParse(raw);
  if (!parsed.success) return err("This lead was not found.");
  if (!(await takeRateLimit(rateLimitKey("admin-draft", admin.id), 60, 10))) return err(SLOW_DOWN);
  try {
    const result = await createDraft(parsed.data.leadId, actorOf(admin));
    if (!result.ok) {
      if (result.reason === "limit") return err("Today's draft limit is reached. Raise it in Growth settings, or write more tomorrow.");
      if (result.reason === "do_not_contact") return err("This lead is marked do not contact.");
      return err("This lead was not found.");
    }
    const { firstMessage, followUp, writer, model, note } = result.draft;
    revalidatePath(`${GROWTH_PATH}/${parsed.data.leadId}`);
    return ok({ firstMessage, followUp, writer, model, note });
  } catch (error) {
    logger.error("marketing.write_draft_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't write a draft. Try again.");
  }
}

/** Notes that the lead's one follow-up was sent. */
export async function markFollowUpSentAction(raw: unknown): Promise<Result<{ message: string }>> {
  const admin = await requireAdmin();
  const parsed = leadInput.safeParse(raw);
  if (!parsed.success) return err("This lead was not found.");
  if (!(await takeRateLimit(rateLimitKey("admin-lead-update", admin.id), 120, 10))) return err(SLOW_DOWN);
  try {
    if (!(await markFollowUpSent(parsed.data.leadId, actorOf(admin)))) return err("Only a contacted lead without a follow-up yet can be marked.");
    revalidatePath(GROWTH_PATH);
    return ok({ message: "Follow-up marked as sent." });
  } catch (error) {
    logger.error("marketing.follow_up_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save that. Try again.");
  }
}

/** Saves the founder's voice examples and the daily limits. */
export async function saveGrowthSettingsAction(raw: unknown): Promise<Result<{ message: string }>> {
  const admin = await requireAdmin();
  const parsed = growthSettingsInput.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the form and try again.");
  if (!(await takeRateLimit(rateLimitKey("admin-lead-update", admin.id), 120, 10))) return err(SLOW_DOWN);
  try {
    await saveGrowthSettings(parsed.data);
    revalidatePath(GROWTH_PATH);
    return ok({ message: "Settings saved." });
  } catch (error) {
    logger.error("marketing.settings_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save the settings. Try again.");
  }
}
