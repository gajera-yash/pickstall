# Deploying Pickstall to Vercel

> Written 2026-11-15 from the current code (commit `7c76eb4`); payments moved to **PayPal** on 2026-11-21 (D-118). PayPal stays in **sandbox** until live mode is approved (CLAUDE.md 7).
> Vercel builds every deployment, Preview included, with `NODE_ENV=production`: the development MockProvider is off there, so payments need a PayPal sandbox setup (step 6). Stripe is dormant (only with `PAYMENT_PROVIDER=stripe`; old step 6b).

## 0. File storage on Vercel (D-077)

Vercel functions cannot keep files on disk, and a request body is limited to about 4.5 MB. So:

- **Images** (store photo, product and course covers) are saved in MongoDB (`mediaBlobs`), up to 4 MB each and 60 MB per store; replaced images are cleared automatically when a store runs out of space. Nothing to set up. Watch the Atlas storage size: the free M0 cluster has about 512 MB in total.
- **Product files and lesson files** cannot be uploaded on the live site yet. The editor says so and creators deliver with a link (Google Drive, Dropbox, Notion). Course videos go to Bunny Stream and are not affected.
- When file uploads are needed, move files to object storage (Cloudflare R2 was the chosen option; free up to 10 GB). Do not set `UPLOAD_DIR` or `PRODUCT_FILES_DIR` on Vercel.

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
| `PAYPAL_MODE` | `sandbox` | `live` only after PayPal live approval. |
| `PAYPAL_CLIENT_ID` | from your PayPal app | Your OWN PayPal REST app (step 6): Pickstall plan billing. |
| `PAYPAL_CLIENT_SECRET` | from your PayPal app | Server only. |
| `PAYPAL_WEBHOOK_ID` | `WH-...` | The webhook you add on your app in step 6. |
| `PAYMENT_CREDENTIALS_KEY` | 32 random bytes, base64 | Encrypts creators' PayPal secrets. Never change it later. |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Dormant since D-118; leave empty unless `PAYMENT_PROVIDER=stripe`. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | `whsec_...` | From the Connect webhook endpoint (step 6). |
| `STRIPE_PLATFORM_WEBHOOK_SECRET` | `whsec_...` | From the platform webhook endpoint (step 6). A different secret. |
| `STRIPE_CONNECT_CLIENT_ID` | `ca_...` | Stripe > Connect settings. |
| `STRIPE_PLATFORM_ACCOUNT_ID` | `acct_...` | Optional, test mode only (D-034 shortcut). |
| `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY`, `BUNNY_STREAM_READONLY_KEY` | from Bunny Stream | Course video upload and signed playback (D-055). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` | from Google Cloud | Optional. Leave out to hide the Google button. |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | from Sentry > Project > Client Keys | Optional but recommended: error monitoring (D-075). Same DSN in both. Leave out to turn it off. |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | from Sentry | Optional: uploads source maps at build time so errors show real file names. The token is secret. |

Do **not** set `UPLOAD_DIR`, `PRODUCT_FILES_DIR` or `DEV_ALLOWED_HOSTS` on Vercel.

Then **Deployments > Redeploy** so the build picks the values up.

## 5. Resend (sign-in codes and order emails)

1. Resend > Domains > add `pickstall.store` (or a subdomain such as `mail.pickstall.store`).
2. Add the DNS records Resend shows (SPF, DKIM, optional DMARC) at your domain registrar. Wait until Resend says **Verified**.
3. Until the domain is verified, Resend only delivers to your own Resend account email, so other people cannot receive their sign-in code **and buyers get no order email** (your own tests still work, which hides the problem).
4. In Vercel, set `EMAIL_FROM` to an address on the verified domain, for example `Pickstall <orders@pickstall.store>`, then redeploy. Without it the app falls back to Resend's test sender (`onboarding@resend.dev`), with the same problem, and Sentry reports `email.sender_not_verified`.
5. Check: buy a product from a private window with an email address that is **not** your Resend login. In the dashboard, Orders > the order > Delivery shows "Access email: Sent". If it says "Not delivered", fix the sender, then press **Send again**.

## 6. PayPal (sandbox, D-118)

Two money flows, never mixed:
- **Creators' sales:** each creator pastes the Client ID and Secret of THEIR OWN PayPal REST app in Settings > Payments. Pickstall checks the keys, adds the webhook `https://<domain>/api/webhooks/paypal/<storeId>` on their app by itself, and stores the Secret encrypted. Buyers pay the creator directly; Pickstall takes no fee.
- **Pickstall plans:** YOUR own PayPal REST app.

Steps on developer.paypal.com with your PayPal **Business** account, **Sandbox** selected:
1. Apps & Credentials > Create App (Merchant). Copy its Client ID and Secret into `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
2. In that app, add a webhook: URL `https://<domain>/api/webhooks/paypal`, events `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.UPDATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.EXPIRED`, `BILLING.SUBSCRIPTION.PAYMENT.FAILED`, `PAYMENT.SALE.COMPLETED`. Copy the webhook id into `PAYPAL_WEBHOOK_ID`.
3. Generate `PAYMENT_CREDENTIALS_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Keep it safe; changing it later forces every creator to reconnect.
4. Plans need no setup: Pickstall creates the product `PICKSTALL-PLANS` and the Starter and Pro monthly USD plans the first time someone subscribes (names carry the price from `PLANNED_PRICE_CENTS`).
5. Inngest must run (step 7b): the `paypal-pending-sweep` job captures approved checkouts the buyer never returned from and frees coupons and booked times of abandoned ones.
6. For testing, create a sandbox **personal** buyer account under Testing Tools > Sandbox Accounts.

**Live mode (before real money):** apply for PayPal live approval of your Business account, then set `PAYPAL_MODE=live` with a live app's keys and webhook. Creators must then connect a **Live** app. Note: a PayPal business account in India cannot receive payments from buyers in India (international payments only), and PayPal Subscriptions do not support INR, so plans are billed in USD. For one-click "Connect PayPal" (no keys to paste), apply to the PayPal partner program (Commerce Platform); that replaces only the connect step.

## 6b. Stripe (dormant, only with PAYMENT_PROVIDER=stripe)

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

## 7b. Inngest (coaching call reminders, D-085)

Coaching calls send reminder emails 24 hours and 1 hour before the call through Inngest (free plan).
Without these keys everything else works; only the reminders are not sent.

1. Create a free account at inngest.com and open the production environment.
2. Copy the **Event key** into `INNGEST_EVENT_KEY` and the **Signing key** into `INNGEST_SIGNING_KEY` (Vercel > Settings > Environment Variables), then redeploy.
3. In the Inngest dashboard, sync the app with the URL `https://<your domain>/api/inngest`. The function "coaching-call-reminders" should appear.
4. Local testing: run the Inngest dev server and set `INNGEST_DEV=1` in `.env.local` (no keys needed).

## 8. Google sign-in (optional)

Google Cloud Console > Credentials > your OAuth client > **Authorized redirect URIs:** add `https://pickstall.store/api/auth/callback/google`. Also add `https://pickstall.store` to Authorized JavaScript origins.

## 9. Domain

1. Vercel > Settings > **Domains** > add `pickstall.store` and `www.pickstall.store` (redirect `www` to the apex).
2. At your registrar, add the DNS records Vercel shows. HTTPS is issued automatically.
3. Set `NEXT_PUBLIC_APP_URL=https://pickstall.store` and `NEXT_PUBLIC_ROOT_DOMAIN=pickstall.store`, then redeploy.

## 10. Check the live site

- [ ] `https://pickstall.store` loads; the response has the security headers (`Strict-Transport-Security`, `Content-Security-Policy`).
- [ ] Sign up with a real email: the 6-digit code arrives (Resend), you land on the dashboard.
- [ ] Create a store, connect PayPal with a sandbox app's keys, add and publish a product.
- [ ] Buy it from a private window with a sandbox personal account: the order shows as paid, the email arrives, the library opens it.
- [ ] developer.paypal.com > your creator app > Webhooks events shows deliveries with `200`.
- [ ] Refund from the order drawer (or in PayPal): access is removed.
- [ ] Subscribe to a plan with a sandbox buyer: Settings > Plan shows it active; Admin > Billing shows the payment.
- [ ] Image and file uploads: only after the storage change in section 0.
- [ ] `https://pickstall.store/api/health` answers `{"status":"ok","database":"ok"}`.
- [ ] Vercel > Logs: no errors.

## 11. After launch

- Tell alpha creators it is a test version (PRD 8.2) until PayPal live mode is approved.
- Follow `docs/OPS_RUNBOOK.md`: uptime monitor on `/api/health`, Sentry alerts, Atlas backups, a load test and an independent security review.
- Analytics (PostHog) is not installed yet.
