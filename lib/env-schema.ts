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
  // Where uploaded images are saved (D-032). Default: .data/uploads inside the project. Use a persistent volume in production.
  UPLOAD_DIR: optional(z.string().min(1)),
  // Where product files buyers download are saved (D-050). Private: never served as-is. Default: .data/product-files.
  PRODUCT_FILES_DIR: optional(z.string().min(1)),
  // Bunny Stream for course videos (D-055, D-058). Library id + API key turn upload on.
  BUNNY_STREAM_LIBRARY_ID: optional(z.string().regex(/^\d{1,12}$/, { error: "Must be the numeric library id" })),
  BUNNY_STREAM_API_KEY: optional(z.string().min(8)),
  // Token authentication key (Security page): signs playback links. Not the API key.
  BUNNY_STREAM_TOKEN_KEY: optional(z.string().min(8)),
  // Read-only API key: Bunny signs its webhooks with it (HMAC-SHA256).
  BUNNY_STREAM_READONLY_KEY: optional(z.string().min(8)),
  // Stripe (test mode until the founder approves live mode). Server only; never logged.
  STRIPE_SECRET_KEY: optional(z.string().min(1)),
  STRIPE_CONNECT_WEBHOOK_SECRET: optional(z.string().min(1)),
  // Events of our OWN Stripe account (the test seller account shortcut, later Billing). A separate secret (CLAUDE.md 7).
  STRIPE_PLATFORM_WEBHOOK_SECRET: optional(z.string().min(1)),
  // Connect OAuth client id (ca_...), from Stripe Dashboard > Connect settings. Not secret, but only used on the server.
  STRIPE_CONNECT_CLIENT_ID: optional(z.string().regex(/^ca_[A-Za-z0-9]+$/)),
  // The founder's own Stripe account id. In TEST mode only, a store may use it directly as its seller account (D-034).
  STRIPE_PLATFORM_ACCOUNT_ID: optional(z.string().regex(/^acct_[A-Za-z0-9]+$/)),
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
