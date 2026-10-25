import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }).max(254, { error: "That email is too long." }));

/** 6-digit email code (docs/DECISIONS.md D-002). Spaces are ignored. */
export const emailCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, { error: "Enter the 6-digit code from the email." }));

export const sendCodeInput = z.object({ email: emailSchema });
export const verifyCodeInput = z.object({ email: emailSchema, code: emailCodeSchema, next: z.string().optional() });
