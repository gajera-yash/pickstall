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
  // Browser push (D-132): the VAPID public key the browser subscribes with. Without it the "Turn on
  // browser notifications" button is hidden.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional(z.string().regex(/^[A-Za-z0-9_-]{80,100}$/, { error: "Must be a URL-safe base64 VAPID public key" })),
});

export const serverEnvSchema = publicEnvSchema.extend({
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, { error: "Must be a mongodb:// or mongodb+srv:// URI" }),
  MONGODB_DB: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).default("pickstall")),
  // Signs session cookies (Better Auth). At least 32 random characters.
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: optional(z.string().min(1)),
  GOOGLE_CLIENT_SECRET: optional(z.string().min(1)),
  // Signs browser push messages (D-132); pairs with NEXT_PUBLIC_VAPID_PUBLIC_KEY. Make both with `pnpm push:keys`.
  VAPID_PRIVATE_KEY: optional(z.string().regex(/^[A-Za-z0-9_-]{40,50}$/, { error: "Must be a URL-safe base64 VAPID private key" })),
  // Sends the sign-in code. Optional in development: the code is then written to the server log.
  RESEND_API_KEY: optional(z.string().min(1)),
  EMAIL_FROM: optional(z.string().min(3)),
  // Platform admin sign-in at /admin/login (D-109). Without both, nobody can sign in to /admin.
  ADMIN_USERNAME: optional(z.string().min(3).max(64)),
  ADMIN_PASSWORD: optional(z.string().min(12, { error: "Use at least 12 characters" }).max(200)),
  // Verifies Resend's webhook calls (D-095): bounces and spam complaints unsubscribe people.
  RESEND_WEBHOOK_SECRET: optional(z.string().min(16)),
  // Where uploaded images are saved (D-032). Default: .data/uploads inside the project. Use a persistent volume in production.
  UPLOAD_DIR: optional(z.string().min(1)),
  // Where product files buyers download are saved (D-050). Private: never served as-is. Default: .data/product-files.
  PRODUCT_FILES_DIR: optional(z.string().min(1)),
  // Cloudflare R2 for product and lesson files (D-093): a private bucket, reached with an R2 API
  // token's S3 keys. All four turn R2 on; without them development falls back to the disk folder.
  R2_ACCOUNT_ID: optional(z.string().regex(/^[0-9a-f]{32}$/, { error: "Must be the 32-character Cloudflare account id" })),
  R2_ACCESS_KEY_ID: optional(z.string().min(16)),
  R2_SECRET_ACCESS_KEY: optional(z.string().min(32)),
  R2_BUCKET: optional(z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, { error: "Must be an R2 bucket name" })),
  // Bunny Stream for course videos (D-055, D-058). Library id + API key turn upload on.
  BUNNY_STREAM_LIBRARY_ID: optional(z.string().regex(/^\d{1,12}$/, { error: "Must be the numeric library id" })),
  BUNNY_STREAM_API_KEY: optional(z.string().min(8)),
  // Token authentication key (Security page): signs playback links. Not the API key.
  BUNNY_STREAM_TOKEN_KEY: optional(z.string().min(8)),
  // Read-only API key: Bunny signs its webhooks with it (HMAC-SHA256).
  BUNNY_STREAM_READONLY_KEY: optional(z.string().min(8)),
  // Inngest background jobs (D-085): call reminders. The event key sends events, the signing key
  // verifies Inngest's calls to /api/inngest. Development uses the local dev server with INNGEST_DEV=1.
  INNGEST_EVENT_KEY: optional(z.string().min(1)),
  INNGEST_SIGNING_KEY: optional(z.string().min(1)),
  // Stripe (test mode until the founder approves live mode). Server only; never logged.
  STRIPE_SECRET_KEY: optional(z.string().min(1)),
  STRIPE_CONNECT_WEBHOOK_SECRET: optional(z.string().min(1)),
  // Events of our OWN Stripe account (the test seller account shortcut, later Billing). A separate secret (CLAUDE.md 7).
  STRIPE_PLATFORM_WEBHOOK_SECRET: optional(z.string().min(1)),
  // Connect OAuth client id (ca_...), from Stripe Dashboard > Connect settings. Not secret, but only used on the server.
  STRIPE_CONNECT_CLIENT_ID: optional(z.string().regex(/^ca_[A-Za-z0-9]+$/)),
  // The founder's own Stripe account id. In TEST mode only, a store may use it directly as its seller account (D-034).
  STRIPE_PLATFORM_ACCOUNT_ID: optional(z.string().regex(/^acct_[A-Za-z0-9]+$/)),
  // Which provider takes payments (D-118). PayPal by default; "stripe" turns the dormant Stripe code back on.
  PAYMENT_PROVIDER: optional(z.enum(["paypal", "stripe"])),
  // PayPal (D-118). "sandbox" until the founder approves live mode. Creators' own REST apps must be in the same mode.
  PAYPAL_MODE: optional(z.enum(["sandbox", "live"])),
  // Our OWN PayPal REST app: platform billing (Pickstall plans) only, never creators' sales. Server only.
  PAYPAL_CLIENT_ID: optional(z.string().regex(/^[A-Za-z0-9_-]{20,128}$/, { error: "Must be a PayPal REST app client id" })),
  PAYPAL_CLIENT_SECRET: optional(z.string().min(20)),
  // The id of the webhook registered on our own app for /api/webhooks/paypal (verifies billing events).
  PAYPAL_WEBHOOK_ID: optional(z.string().regex(/^[A-Za-z0-9-]{6,64}$/)),
  // 32 random bytes, base64: encrypts creators' PayPal app secrets at rest (AES-256-GCM). Server only.
  PAYMENT_CREDENTIALS_KEY: optional(z.string().refine((value) => Buffer.from(value, "base64").length === 32, { error: "Must be 32 bytes, base64" })),
  // Hashes client IPs for signup rate limits (D-019). Optional: without it the per-IP limit is off.
  IP_HASH_SECRET: optional(z.string().min(16)),
  // Who writes outreach DM drafts (D-121): "template" (default, no AI) or "groq". Claude comes later.
  MARKETING_AI_PROVIDER: optional(z.enum(["template", "groq"])),
  // Groq API key and model for DM drafts (D-121). Server only; never logged.
  GROQ_API_KEY: optional(z.string().min(20)),
  GROQ_MODEL: optional(z.string().regex(/^[a-z0-9][a-z0-9._/-]{1,80}$/, { error: "Must be a Groq model id" })),
  // Where the daily growth report goes at 21:00 IST (D-122). Without it the report is only saved in Admin > Growth > Reports.
  GROWTH_REPORT_EMAIL: optional(z.email()),
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
