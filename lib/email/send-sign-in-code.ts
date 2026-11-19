import "server-only";

import { Resend } from "resend";

import { APP_NAME } from "@/lib/config";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";

/**
 * The sign-in code email designed in Resend (D-091): the published template with the alias
 * "verification-code". Resend accepts a template's id or alias. The code goes in as `code` ({{code}} in the template)
 * (Resend variable names: letters, numbers and underscores).
 */
export const SIGN_IN_TEMPLATE = { id: "verification-code", codeVariable: "code" } as const;

/**
 * Emails the 6-digit sign-in code with the Resend template. If Resend refuses the template (not
 * published, or a variable name that does not match), the same code goes out as a plain email, so
 * nobody is locked out. Without RESEND_API_KEY, development writes the code to the server log
 * instead (never in production: there a missing key is an error).
 */
export async function sendSignInCode(email: string, code: string): Promise<void> {
  const apiKey = serverEnv.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set.");
    logger.debug("auth.dev_sign_in_code", { code });
    return;
  }

  const resend = new Resend(apiKey);
  const from = serverEnv.EMAIL_FROM ?? `${APP_NAME} <onboarding@resend.dev>`; // see usesTestSender in ./send.ts
  const subject = `${code} is your ${APP_NAME} code`;

  const templated = await resend.emails.send({
    from,
    to: email,
    subject,
    template: { id: SIGN_IN_TEMPLATE.id, variables: { [SIGN_IN_TEMPLATE.codeVariable]: code } },
  });
  if (!templated.error) return;

  // Reported (Sentry), then the plain email: the template must never block a sign-in.
  logger.error("email.sign_in_template_failed", { name: templated.error.name, message: templated.error.message });
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject,
    text: `Your ${APP_NAME} sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not ask for it, you can ignore this email.`,
  });
  if (error) {
    logger.error("email.sign_in_code_failed", { name: error.name, message: error.message });
    throw new Error("Could not send the sign-in code.");
  }
}
