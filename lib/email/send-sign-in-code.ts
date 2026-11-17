import "server-only";

import { Resend } from "resend";

import { APP_NAME } from "@/lib/config";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";

/**
 * Emails the 6-digit sign-in code. Without RESEND_API_KEY, development writes the code to the
 * server log instead (never in production: there a missing key is an error).
 */
export async function sendSignInCode(email: string, code: string): Promise<void> {
  const apiKey = serverEnv.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set.");
    logger.debug("auth.dev_sign_in_code", { code });
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: serverEnv.EMAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`, // see usesTestSender in ./send.ts
    to: email,
    subject: `${code} is your ${APP_NAME} code`,
    text: `Your ${APP_NAME} sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not ask for it, you can ignore this email.`,
  });
  if (error) {
    logger.error("email.sign_in_code_failed", { name: error.name, message: error.message });
    throw new Error("Could not send the sign-in code.");
  }
}
