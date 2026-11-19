import "server-only";

import { ensureUnsubscribeTokens, listEmailsFor } from "@/lib/broadcasts/delivery";
import { collections } from "@/lib/db/collections";
import { sendListEmails } from "@/lib/email/send";
import { logger } from "@/lib/logger";

/**
 * Sends the store's welcome email (D-095) to one new subscriber, once: `welcomedAt` is claimed
 * first, so a replayed order or a second call sends nothing. Off, unsubscribed or already welcomed:
 * nothing happens. Never throws (it runs after a sale).
 */
export async function sendWelcomeEmail(storeId: string, subscriberId: string): Promise<"sent" | "skipped" | "failed"> {
  try {
    const { stores, subscribers } = await collections();
    const store = await stores.findOne({ _id: storeId }, { projection: { name: 1, welcomeEmail: 1 } });
    const welcome = store?.welcomeEmail;
    if (!store || !welcome?.enabled) return "skipped";
    const claimed = await subscribers.findOneAndUpdate(
      { _id: subscriberId, storeId, status: "subscribed", welcomedAt: { $in: [null] } },
      { $set: { welcomedAt: new Date() } },
      { projection: { email: 1, name: 1, unsubscribeToken: 1 } },
    );
    if (!claimed) return "skipped";
    const tokens = await ensureUnsubscribeTokens(storeId, [claimed]);
    const emails = listEmailsFor({ storeId, storeName: store.name, subject: welcome.subject, body: welcome.body, replyTo: null, kind: "welcome", people: [claimed], tokens });
    await sendListEmails(emails, `welcome-${subscriberId}`);
    return "sent";
  } catch (error) {
    logger.error("subscribers.welcome_failed", { name: error instanceof Error ? error.name : undefined });
    return "failed";
  }
}
