import "server-only";

import { ensureUnsubscribeTokens, listEmailsFor } from "@/lib/broadcasts/delivery";
import { collections } from "@/lib/db/collections";
import { emailDesignOf } from "@/lib/email/looks";
import { sendListEmails } from "@/lib/email/send";
import { logger } from "@/lib/logger";
import { can, storeAccess } from "@/lib/plans/access";

/**
 * Sends the store's welcome email (D-095) to one new subscriber, once: `welcomedAt` is claimed
 * first, so a replayed order or a second call sends nothing. Off, unsubscribed or already welcomed:
 * nothing happens. Never throws (it runs after a sale).
 */
export async function sendWelcomeEmail(storeId: string, subscriberId: string): Promise<"sent" | "skipped" | "failed"> {
  try {
    const { stores, subscribers } = await collections();
    const store = await stores.findOne({ _id: storeId }, { projection: { name: 1, welcomeEmail: 1, planTier: 1, suspendedAt: 1, trialEndsAt: 1, foundingEndsAt: 1, billing: 1, broadcastsBlocked: 1, emailLook: 1, "theme.accent": 1 } });
    const welcome = store?.welcomeEmail;
    // Automations are a Pro feature (D-098): off on other plans even if it was saved on.
    if (!store || !welcome?.enabled || store.broadcastsBlocked || !can(storeAccess(store), "automations")) return "skipped";
    const claimed = await subscribers.findOneAndUpdate(
      { _id: subscriberId, storeId, status: "subscribed", welcomedAt: { $in: [null] } },
      { $set: { welcomedAt: new Date() } },
      { projection: { email: 1, name: 1, unsubscribeToken: 1 } },
    );
    if (!claimed) return "skipped";
    const tokens = await ensureUnsubscribeTokens(storeId, [claimed]);
    const emails = listEmailsFor({ storeId, storeName: store.name, subject: welcome.subject, body: welcome.body, replyTo: null, kind: "welcome", people: [claimed], tokens, design: emailDesignOf(store) });
    await sendListEmails(emails, `welcome-${subscriberId}`);
    return "sent";
  } catch (error) {
    logger.error("subscribers.welcome_failed", { name: error instanceof Error ? error.name : undefined });
    return "failed";
  }
}
