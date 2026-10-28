import { z } from "zod";

// Pure schemas so they can be unit-tested. Use `lib/env.ts` (public) or
// `lib/env.server.ts` (server only) in app code.

/** An empty value (`NAME=` in .env.local) counts as not set. */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().min(1),
  // Shows the Google button. Set to "true" only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: optional(z.enum(["true", "false"])),
});

export const serverEnvSchema = publicEnvSchema.extend({
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, { error: "Must be a mongodb:// or mongodb+srv:// URI" }),
  MONGODB_DB: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).default("pickstall")),
  // Signs session cookies (Better Auth). At least 32 random characters.
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: optional(z.string().min(1)),
  GOOGLE_CLIENT_SECRET: optional(z.string().min(1)),
  // Sends the sign-in code. Optional in development: the code is then written to the server log.
  RESEND_API_KEY: optional(z.string().min(1)),
  EMAIL_FROM: optional(z.string().min(3)),
  // Hashes client IPs for signup rate limits (D-019). Optional: without it the per-IP limit is off.
  IP_HASH_SECRET: optional(z.string().min(16)),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Parses env values; the error lists variable names only, never values. */
export function parseEnv<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Missing or invalid environment variables: ${names.join(", ")}`);
  }
  return result.data;
}
