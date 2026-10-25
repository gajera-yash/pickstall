import { z } from "zod";

import { optionalPhoneSchema } from "@/lib/phone";
import { slugSchema } from "@/lib/slug";

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

/** True if the text has a control character (code below 32, or 127). */
const hasControlChar = (value: string) => [...value].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127);

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter your full name." })
  .max(80, { error: "Use 80 characters or fewer." })
  .refine((value) => !hasControlChar(value), { error: "Remove the special characters from your name." });

/** Step 1 of the signup wizard. Field order is the order errors are reported in. */
export const signupInput = z.object({
  username: slugSchema,
  fullName: fullNameSchema,
  email: emailSchema,
  phone: optionalPhoneSchema,
});
