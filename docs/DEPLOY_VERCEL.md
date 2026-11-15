# Deploying Pickstall to Vercel

> Written 2026-11-15 from the current code (commit `7c76eb4`). Stripe stays in **test mode** until live mode is approved (CLAUDE.md 7).
> Vercel builds every deployment, Preview included, with `NODE_ENV=production`: the development MockProvider is off there, so payments need Stripe test keys.

## 0. Blocker: file storage (code change first)

Today uploaded images (`UPLOAD_DIR`, D-032) and product files (`PRODUCT_FILES_DIR`, D-050) are saved on the server's disk. On Vercel that does not work:

- The function filesystem is read-only (only `/tmp`, which is wiped between instances), so uploads fail or disappear.
- A request body to a Vercel function is limited to about 4.5 MB. Images are allowed up to 5 MB and product files up to 200 MB (`PRODUCT_FILE_MAX_BYTES`).

Fix before real creators upload: move both stores to object storage, with the browser uploading straight to the bucket through a short-lived signed upload URL, and product files downloaded only through signed URLs of about 60 seconds after the order check (CLAUDE.md 7, PRD F3b). Both storage modules (`lib/media/storage.ts`, `lib/files/storage.ts`) are already behind a small interface, so the routes barely change.

Storage choice is the founder's (CLAUDE.md 2). Options: **Cloudflare R2** (S3-compatible, private buckets, presigned URLs, no egress fees) or **AWS S3** (the PRD's original choice). Course videos already go straight to Bunny Stream and are not affected.

Everything else works on Vercel as it is. You can deploy before the storage change; only image and file uploads fail until it lands.

## 1. Before you start

- [ ] Rotate the secrets that were committed in `97c9217` (D-034): MongoDB password, `BETTER_AUTH_SECRET`, Resend key, Stripe test key. Use the new values below, never the old ones.
- [ ] The code you want live is pushed to GitHub (`main`).
- [ ] Locally green: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`.

## 2. MongoDB Atlas

1. **Network Access > Add IP Address > Allow access from anywhere (`0.0.0.0/0`).** Vercel functions have no fixed IP. Keep a long random database password. (Fixed IPs need Vercel's paid Secure Compute.)
2. Database Access: a database user with read/write on the `pickstall` database only, not an Atlas admin.
3. Note the cluster region (for example AWS `us-east-1`). You will pick the matching Vercel region in step 3.
4. Copy the connection string (Connect > Drivers) for `MONGODB_URI`.

## 3. Create the Vercel project

1. vercel.com > **Add New > Project** > import the `pickstall` GitHub repository.
2. Framework preset: **Next.js** (detected). Root directory: the repo root. Build command `pnpm build`, install command `pnpm install` (defaults).
3. **Settings > Functions > Region:** the region closest to your Atlas cluster (for `us-east-1`: Washington, D.C. `iad1`).
4. If the install step fails on the pnpm version (the repo pins `pnpm@12.15.0` in `packageManager`), add the environment variable `ENABLE_EXPERIMENTAL_COREPACK=1` and redeploy, so Vercel uses the pinned version.

## 4. Environment variables

Vercel > Settings > Environment Variables. Add them for **Production** (and Preview if you use preview links). Never paste them into code or git.

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://pickstall.store` | Your real domain. Before the domain is connected, the `https://<project>.vercel.app` URL. Redeploy after changing it (it is built into the page). |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `pickstall.store` | No `https://`. Store links show as `pickstall.store/@username`. |
| `MONGODB_URI` | from Atlas | New password (rotated). |
| `MONGODB_DB` | `pickstall` | Use a different name (for example `pickstall_preview`) for Preview so tests never touch real data. |
| `BETTER_AUTH_SECRET` | 32+ random characters | New value. `openssl rand -base64 32`. Changing it signs everyone out. |
| `IP_HASH_SECRET` | 16+ random characters | Turns on per-IP rate limits. |
| `RESEND_API_KEY` | from Resend | **Required in production**: without it the sign-in code cannot be sent and nobody can log in. |
| `EMAIL_FROM` | `Pickstall <login@pickstall.store>` | Must use a domain verified in Resend (step 5). |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Test mode. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | `whsec_...` | From the Connect webhook endpoint (step 6). |
| `STRIPE_PLATFORM_WEBHOOK_SECRET` | `whsec_...` | From the platform webhook endpoint (step 6). A different secret. |
| `STRIPE_CONNECT_CLIENT_ID` | `ca_...` | Stripe > Connect settings. |
| `STRIPE_PLATFORM_ACCOUNT_ID` | `acct_...` | Optional, test mode only (D-034 shortcut). |
| `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY`, `BUNNY_STREAM_READONLY_KEY` | from Bunny Stream | Course video upload and signed playback (D-055). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` | from Google Cloud | Optional. Leave out to hide the Google button. |

Do **not** set `UPLOAD_DIR`, `PRODUCT_FILES_DIR` or `DEV_ALLOWED_HOSTS` on Vercel.

Then **Deployments > Redeploy** so the build picks the values up.

## 5. Resend (sign-in codes and order emails)

1. Resend > Domains > add `pickstall.store` (or a subdomain such as `mail.pickstall.store`).
2. Add the DNS records Resend shows (SPF, DKIM, optional DMARC) at your domain registrar. Wait until Resend says **Verified**.
3. Until the domain is verified, Resend only delivers to your own Resend account email, so other people cannot receive their sign-in code.

## 6. Stripe (test mode)

Stripe Dashboard, **Test mode** on:

1. **Developers > Webhooks > Add endpoint** for connected accounts:
   - URL `https://pickstall.store/api/webhooks/stripe-connect`, "Listen to events on **Connected accounts**".
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `account.updated`, `account.application.deauthorized`.
   - Copy its signing secret into `STRIPE_CONNECT_WEBHOOK_SECRET`.
2. **Add endpoint** for your own account:
   - URL `https://pickstall.store/api/webhooks/stripe`, "Listen to events on **Your account**".
   - Same checkout and refund events (used by the test seller shortcut), plus the plan subscription events (D-073): `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`.
   - Copy its signing secret into `STRIPE_PLATFORM_WEBHOOK_SECRET`.
3. **Connect > Settings > OAuth > Redirects:** add `https://pickstall.store/api/connect/stripe/callback`.
4. **Settings > Billing > Customer portal** (test mode, then live): turn on "update payment method", "view invoices" and "cancel subscription" (cancel at the end of the period), set the return link to `https://pickstall.store/dashboard/settings/plan`, and **Save**. Plan switching happens in Pickstall, so leave "switch plans" off.
5. Plan prices need no setup: Pickstall creates the Starter and Pro monthly prices in Stripe the first time someone subscribes (lookup keys `pickstall_starter_monthly`, `pickstall_pro_monthly`, amounts from `PLANNED_PRICE_CENTS`).
6. Redeploy after adding the secrets.

**Live mode with a Stripe India account (before real money):** Stripe India onboards registered businesses (sole proprietorship, LLP or company), not individuals; turn on export of services and the right purpose code during onboarding; customers outside India must give their name and billing address (Checkout asks for the address). Check these on docs.stripe.com/india-accept-international-payments when you apply.

## 7. Bunny Stream (course videos)

Bunny > Stream > your library > **Webhook URL:** `https://pickstall.store/api/webhooks/bunny`. Bunny signs it with the read-only API key (`BUNNY_STREAM_READONLY_KEY`).

## 8. Google sign-in (optional)

Google Cloud Console > Credentials > your OAuth client > **Authorized redirect URIs:** add `https://pickstall.store/api/auth/callback/google`. Also add `https://pickstall.store` to Authorized JavaScript origins.

## 9. Domain

1. Vercel > Settings > **Domains** > add `pickstall.store` and `www.pickstall.store` (redirect `www` to the apex).
2. At your registrar, add the DNS records Vercel shows. HTTPS is issued automatically.
3. Set `NEXT_PUBLIC_APP_URL=https://pickstall.store` and `NEXT_PUBLIC_ROOT_DOMAIN=pickstall.store`, then redeploy.

## 10. Check the live site

- [ ] `https://pickstall.store` loads; the response has the security headers (`Strict-Transport-Security`, `Content-Security-Policy`).
- [ ] Sign up with a real email: the 6-digit code arrives (Resend), you land on the dashboard.
- [ ] Create a store, connect Stripe (test), add and publish a product.
- [ ] Buy it from a private window with a Stripe test card (`4242 4242 4242 4242`): the order shows as paid, the email arrives, the library opens it.
- [ ] Stripe > Webhooks shows the events delivered with `200`.
- [ ] Refund in Stripe: access is removed.
- [ ] Image and file uploads: only after the storage change in section 0.
- [ ] Vercel > Logs: no errors.

## 11. After launch

- Tell alpha creators it is a test version (PRD 8.2) until Stripe live mode is approved.
- Error monitoring (Sentry) and analytics (PostHog) are not installed yet.
- Atlas backups: turn on Cloud Backup on a paid tier, or schedule exports, before real data matters.
