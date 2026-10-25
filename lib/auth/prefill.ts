import { fullNameSchema } from "@/lib/auth/schemas";
import { slugSchema } from "@/lib/slug";

export type SignupPrefill = { fullName?: string; username?: string };

/**
 * Suggestions for the store step, taken from the auth user metadata (the signup form, or Google's
 * profile name). That metadata is UNTRUSTED: a signed-in user can edit it, so every value is
 * re-validated here and again on the server when the store is created. It is only ever used to
 * pre-fill form fields, never for access decisions.
 */
export function signupPrefill(metadata: unknown): SignupPrefill {
  if (typeof metadata !== "object" || metadata === null) return {};
  const data = metadata as Record<string, unknown>;
  const prefill: SignupPrefill = {};

  const nameResult = fullNameSchema.safeParse(data.full_name ?? data.name);
  if (nameResult.success) prefill.fullName = nameResult.data;

  const slugResult = slugSchema.safeParse(data.requested_slug);
  if (slugResult.success) prefill.username = slugResult.data;

  return prefill;
}
