import "server-only";

import { Resend } from "resend";

import { APP_NAME } from "@/lib/config";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";

/** A small file sent with the email (Resend `attachments`: filename, content, content type). */
export type EmailAttachment = { filename: string; content: string; contentType: string };

export type OutgoingEmail = { to: string; subject: string; text: string; html: string; attachments?: EmailAttachment[] };

const RESEND_TEST_SENDER = `${APP_NAME} <onboarding@resend.dev>`;

/**
 * True when the sender is Resend's shared test address (no EMAIL_FROM, or a resend.dev address).
 * Resend delivers those only to the Resend account owner's own inbox, so buyers and other creators
 * get nothing: EMAIL_FROM must use a domain verified in Resend (docs/DEPLOY_VERCEL.md step 5).
 */
export function usesTestSender(from: string | undefined): boolean {
  return !from || /@resend\.dev>?\s*$/i.test(from.trim());
}

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
  if (process.env.NODE_ENV === "production" && usesTestSender(serverEnv.EMAIL_FROM)) {
    // Reported every time (Sentry), because most emails will not arrive until this is fixed.
    logger.error("email.sender_not_verified", { hint: "Set EMAIL_FROM to an address on a domain verified in Resend." });
  }
  const { error } = await new Resend(apiKey).emails.send({
    from: serverEnv.EMAIL_FROM ?? RESEND_TEST_SENDER,
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    ...(email.attachments?.length ? { attachments: email.attachments.map((file) => ({ filename: file.filename, content: Buffer.from(file.content, "utf8"), contentType: file.contentType })) } : {}),
  });
  if (error) {
    // Resend's error name says why (for example "validation_error" for an unverified sender).
    logger.error("email.send_failed", { name: error.name, testSender: usesTestSender(serverEnv.EMAIL_FROM) });
    throw new Error("Could not send the email.");
  }
}
