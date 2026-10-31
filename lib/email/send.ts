import "server-only";

import { Resend } from "resend";

import { APP_NAME } from "@/lib/config";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";

export type OutgoingEmail = { to: string; subject: string; text: string; html: string };

/**
 * Sends an email with Resend. Without RESEND_API_KEY, development only logs that it would send (the
 * sign-in code email has its own dev log); production without a key is an error. Never logs the body.
 */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const apiKey = serverEnv.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set.");
    logger.info("email.dev_not_sent", { subject: email.subject });
    return;
  }
  const { error } = await new Resend(apiKey).emails.send({
    from: serverEnv.EMAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  if (error) {
    logger.error("email.send_failed", { name: error.name });
    throw new Error("Could not send the email.");
  }
}
