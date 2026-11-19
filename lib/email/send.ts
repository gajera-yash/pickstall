import "server-only";

import { Resend } from "resend";

import { APP_NAME } from "@/lib/config";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";

/** A small file sent with the email (Resend `attachments`: filename, content, content type). */
export type EmailAttachment = { filename: string; content: string; contentType: string };

export type OutgoingEmail = { to: string; subject: string; text: string; html: string; attachments?: EmailAttachment[] };

/**
 * An email to someone on a creator's list (D-095): sent as "{store} via Pickstall", replies go to
 * the creator, with one-click unsubscribe headers and tags that Resend's webhook sends back.
 */
export type ListEmail = { to: string; subject: string; text: string; html: string; fromName: string; replyTo: string | null; headers: Record<string, string>; tags: { name: string; value: string }[] };

const RESEND_TEST_SENDER = `${APP_NAME} <onboarding@resend.dev>`;

/**
 * True when the sender is Resend's shared test address (no EMAIL_FROM, or a resend.dev address).
 * Resend delivers those only to the Resend account owner's own inbox, so buyers and other creators
 * get nothing: EMAIL_FROM must use a domain verified in Resend (docs/DEPLOY_VERCEL.md step 5).
 */
export function usesTestSender(from: string | undefined): boolean {
  return !from || /@resend\.dev>?\s*$/i.test(from.trim());
}

/** A failed send, with Resend's error code (for example "validation_error") as `reason` for the logs. */
export class EmailSendError extends Error {
  constructor(readonly reason: string) {
    super("Could not send the email.");
    this.name = "EmailSendError";
  }
}

/** Resend's error message for the logs, with any email address masked (never log full emails). */
export function maskedProviderMessage(message: unknown): string | undefined {
  if (typeof message !== "string") return undefined;
  return message.replace(/[^\s@<>"'`]+@[^\s@<>"'`]+/g, "[email]").slice(0, 300);
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
    // Resend's error name and message say why (for example "validation_error" for an unverified
    // sender domain, or a rate limit). Addresses in the message are masked.
    logger.error("email.send_failed", { name: error.name, detail: maskedProviderMessage(error.message), testSender: usesTestSender(serverEnv.EMAIL_FROM) });
    throw new EmailSendError(error.name);
  }
}

function senderAddress(): string {
  const from = serverEnv.EMAIL_FROM ?? RESEND_TEST_SENDER;
  return /<([^<>\s]+@[^<>\s]+)>/.exec(from)?.[1] ?? from.trim();
}

/**
 * Sends up to 100 list emails in one Resend batch call. The idempotency key makes a retried call
 * (same key within 24 hours) send nothing twice. Without RESEND_API_KEY, development only logs.
 */
export async function sendListEmails(emails: ListEmail[], idempotencyKey: string): Promise<void> {
  if (emails.length === 0) return;
  if (emails.length > 100) throw new Error("A Resend batch holds at most 100 emails.");
  const apiKey = serverEnv.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set.");
    logger.info("email.dev_list_not_sent", { count: emails.length });
    return;
  }
  const address = senderAddress();
  const { error } = await new Resend(apiKey).batch.send(
    emails.map((email) => ({
      from: `${email.fromName} <${address}>`,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      headers: email.headers,
      tags: email.tags,
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    })),
    { idempotencyKey },
  );
  if (error) {
    logger.error("email.list_send_failed", { name: error.name, count: emails.length });
    throw new Error("Could not send the emails.");
  }
}
