import { z } from "zod";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/config";

/** New password with confirmation (D-037). Length limits come from lib/config.ts; no composition rules, long beats complex. */
export const passwordInput = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, { error: `Use at least ${PASSWORD_MIN_LENGTH} characters.` })
      .max(PASSWORD_MAX_LENGTH, { error: `Use ${PASSWORD_MAX_LENGTH} characters or fewer.` }),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, { error: "The two passwords don't match.", path: ["confirm"] });

/** Password login: the password is only length-capped here, so a wrong one reads as "incorrect", never as a rule. */
export const passwordLoginInput = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email({ error: "Enter a valid email address." })),
  password: z.string().min(1, { error: "Enter your password." }).max(PASSWORD_MAX_LENGTH, { error: "That password is incorrect." }),
  next: z.string().max(300).optional(),
});
