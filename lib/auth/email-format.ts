import { emailSchema } from "@/lib/auth/schemas";

// Live email check on the signup form. Format only, with the same schema the server uses, so the
// hint never disagrees with the real submit. It never looks up accounts (CLAUDE.md 8: errors must
// not reveal whether an email exists).

export type EmailFormat = { status: "empty" } | { status: "valid" } | { status: "invalid"; message: string };

export function checkEmailFormat(value: string): EmailFormat {
  if (value.trim() === "") return { status: "empty" };
  const result = emailSchema.safeParse(value);
  if (result.success) return { status: "valid" };
  return { status: "invalid", message: result.error.issues[0]?.message ?? "Enter a valid email address." };
}
