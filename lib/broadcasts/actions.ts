"use server";

import { revalidatePath } from "next/cache";

import { startBroadcastJob } from "@/lib/broadcasts/job";
import { countBroadcastsStartedSince, createSendingBroadcast, markBroadcastFailed, saveWelcomeEmail } from "@/lib/broadcasts/queries";
import { broadcastProblem, listEmailInput, renderListEmail, senderName, type ListEmailInput } from "@/lib/broadcasts/rules";
import { requireCreator } from "@/lib/auth/guards";
import { publicEnv } from "@/lib/env";
import { sendListEmails } from "@/lib/email/send";
import { logger } from "@/lib/logger";
import { AUTOMATIONS_PRO, can, subscriberLimit } from "@/lib/plans/access";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";
import { countSubscribed } from "@/lib/subscribers/queries";

// Broadcasts and the welcome email (D-095). The store and the creator's email always come from the
// session; the list only ever holds people who agreed to the store's emails (D-094).

const BROADCASTS_PATH = "/dashboard/marketing/broadcasts";
const SUBSCRIBERS_PATH = "/dashboard/marketing/subscribers";

function parse(raw: unknown): Result<ListEmailInput> {
  const parsed = listEmailInput.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issue = parsed.error.issues[0];
  const field = issue?.path[0];
  return err(issue?.message ?? "Check the email and try again.", typeof field === "string" ? field : undefined);
}

/** Sends the email to the signed-in creator only, so they can see it before their list does. */
export async function sendTestListEmail(raw: unknown): Promise<Result<{ to: string }>> {
  const { user, store } = await requireCreator(BROADCASTS_PATH);
  const input = parse(raw);
  if (!input.ok) return input;
  if (!user.email) return err("Add an email to your account to get tests.");
  const to = user.email;
  if (!(await takeRateLimit(rateLimitKey("list-test:owner", user.id), 10, 60))) return err("You have sent a lot of tests. Try again in a little while.");
  try {
    // The test's footer link opens the creator's own list instead of unsubscribing anyone.
    const rendered = renderListEmail({ storeName: store.name, subject: `[Test] ${input.data.subject}`, body: input.data.body, name: null, unsubscribeUrl: `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}${SUBSCRIBERS_PATH}` });
    await sendListEmails([{ to, ...rendered, fromName: senderName(store.name), replyTo: null, headers: {}, tags: [{ name: "kind", value: "test" }] }], `test-${user.id}-${Date.now()}`);
    return ok({ to });
  } catch (error) {
    logger.error("broadcasts.test_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't send the test. Try again.");
  }
}

/** Starts sending a broadcast to everyone subscribed to the session owner's store. */
export async function sendBroadcastAction(raw: unknown): Promise<Result<{ id: string; recipients: number }>> {
  const { user, store } = await requireCreator(BROADCASTS_PATH);
  const input = parse(raw);
  if (!input.ok) return input;
  if (!(await takeRateLimit(rateLimitKey("broadcast:owner", user.id), 10, 60))) return err("Slow down a little, then try again.");

  try {
    const now = new Date();
    const [subscribed, startedToday] = await Promise.all([countSubscribed(store.id), countBroadcastsStartedSince(store.id, now)]);
    const problem = broadcastProblem({ subscribed, startedToday, limit: subscriberLimit(store.access), blocked: store.broadcastsBlocked || store.access.state === "suspended" });
    if (problem) return err(problem);

    const id = await createSendingBroadcast(store.id, input.data, user.email, subscribed, now);
    if (!(await startBroadcastJob(id))) {
      await markBroadcastFailed(id);
      return err("Sending isn't set up yet. Try again later.");
    }
    revalidatePath(BROADCASTS_PATH);
    return ok({ id, recipients: subscribed });
  } catch (error) {
    logger.error("broadcasts.send_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't start sending. Try again.");
  }
}

/** Saves the welcome email of the session owner's store. Turning it off keeps the text. */
export async function saveWelcomeEmailAction(raw: unknown): Promise<Result<{ enabled: boolean }>> {
  const { user, store } = await requireCreator(SUBSCRIBERS_PATH);
  const enabled = typeof raw === "object" && raw !== null && (raw as { enabled?: unknown }).enabled === true;
  const input = parse(raw);
  if (!input.ok) return input;
  // A Pro feature (D-098): it can always be saved off, only turned on with the plan.
  if (enabled && !can(store.access, "automations")) return err(AUTOMATIONS_PRO);
  if (!(await takeRateLimit(rateLimitKey("welcome-write:owner", user.id), 30, 10))) return err("Slow down a little, then try again.");
  try {
    await saveWelcomeEmail(store.id, { enabled, subject: input.data.subject, body: input.data.body });
  } catch (error) {
    logger.error("subscribers.welcome_save_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't save. Try again.");
  }
  revalidatePath(SUBSCRIBERS_PATH);
  return ok({ enabled });
}
