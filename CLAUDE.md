# CLAUDE.md: Project rules for AI coding tools

You are helping a solo founder build **Pickstall**, a Stan Store-style platform for online course creators. The full spec is in `PRD.md`. **Do not read whole spec files by default (they are long). Use the read map in section 1.1 and read only the sections the current task needs.** If this file and the PRD conflict, ask the founder. `DESIGN.md` is the source of truth for colors, typography, spacing, components and motion.

## 1. How to work

1. **One milestone at a time.** Milestones are listed in `PRD.md` section 8 (M0-M11); the current phase scope is in `PHASE1_PLAN.md` and the full roadmap in `PRD.md` section 12. Do only the milestone or task requested. Do not build ahead.
2. **Plan first.** For any task touching more than 2 files, the database, auth, or payments, write a short plan (files to change, approach, risks) and wait for approval before coding.
3. **Small, reviewable changes.** Prefer several small commits over one giant change. Commit message format: `feat(scope): summary`, `fix(scope): summary`.
4. **Ask before**: changing the database schema, adding a new dependency, changing auth or payment logic, or deleting files.
5. **Never invent.** If a requirement, API behavior or library detail is unclear, say so and ask, or check the official docs. Do not guess Stripe, Bunny.net, MongoDB, Better Auth or Resend API shapes.
6. After finishing a task, report: what changed, how to run/test it, what was NOT done, and any security-relevant decisions.
7. Keep answers to the founder in simple English or Hinglish; keep code, comments, commit messages and docs in English.

### 1.1 Read map (save tokens: never read whole spec files by default)

`PRD.md` and `DESIGN.md` are long. Read only the sections below for the current block, using `grep` or section headings to jump to them.

| Block | Read from PRD.md | Read from DESIGN.md | Read from this file |
|---|---|---|---|
| A: foundation, schema, auth (done) | section 2, 5.4 (data model) | none | sections 5, 6, 8 |
| B: login, signup, dashboard | F1, F8, 5.8 (routes) | sections 0, 3-6, 9 (button, input, card), 10.2, 10.7, 10.8, 13, 15 | sections 5, 8 |
| C: products and store page | F2, F3b, F4 (product page and checkout fields), 5.2 (routing), 5.4 and 5.4.1 (products, files, planned additions) | sections 9, 10.4, 10.8, 11 | sections 5, 6, 8 (customization guardrails) |
| D: payments | section 2, F4, 5.4.1, 5.6 (A to C) | section 10.5 | sections 7, 8 |
| E: emails | F7, F3b (email customization) | none | sections 5, 8 |
| F: security and deploy | section 6 | none | section 8 |

UI reference images, when they exist, live in `docs/ui-reference/` and are named by screen (for example `signup.png`, `my-store.png`). Read the one image for the screen you are building, never the whole folder.

Rules: do not paste or re-read whole files into the chat; reference file paths and section names instead. Keep command output short (quiet flags, `| tail -n 40`). Start a fresh session for every block.

## 2. Tech stack (do not substitute)

- Next.js (latest stable, App Router), **TypeScript strict**, React Server Components by default
- Tailwind CSS + shadcn/ui + lucide-react
- MongoDB (official `mongodb` driver, no ORM) + **Better Auth** (email 6-digit code, Google, sessions) (D-024). Product and lesson files live in a private Cloudflare R2 bucket (D-093); images stay in MongoDB (D-077)
- Stripe (Connect **Standard** + Checkout **direct charges**; Billing for platform plans), accessed only through a provider-agnostic `PaymentProvider` interface (a PayPal adapter may be added later, only when the founder asks)
- Bunny.net Stream (course video: direct TUS upload, signed playback; D-055) plus YouTube/Vimeo links, Resend + React Email, Inngest (background jobs)
- Zod (validation), Vitest (unit), Playwright (e2e), PostHog, Sentry
- Package manager: `pnpm`

## 3. Commands

```
pnpm dev            # run locally
pnpm build          # production build
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest
pnpm test:e2e       # playwright
pnpm test:unit      # unit tests only (no database)
```
Run `pnpm lint && pnpm typecheck && pnpm test:unit` before declaring a task done. Never drop or clear collections in the founder's MongoDB.

## 4. Project structure

```
/app            routes (marketing, dashboard, store, student, api/webhooks)
/components     shadcn ui + feature components
/lib            config, payments, db (MongoDB), email, video, auth guards
/lib/db         MongoDB client, indexes (lib/db/mongo.ts) and document types (lib/db/collections.ts) = source of truth for the data model
/tests          unit + e2e
```
Business logic lives in `/lib`, not inside components or route files. Route handlers stay thin: validate, authorize, call a `/lib` function, return.

## 5. Coding conventions

- TypeScript `strict: true`. No `any` (use `unknown` + narrowing). No `@ts-ignore` without a comment explaining why.
- Validate **every** external input (request body, query, form, webhook payload) with Zod at the boundary.
- Use Server Actions or route handlers for mutations. Return typed results `{ ok: true, data } | { ok: false, error }`; do not leak internal errors to the client.
- Money is **always integer cents** plus a currency code. Never use floats for money.
- IDs are UUIDs. Timestamps are `timestamptz` in UTC.
- Config constants (`APP_NAME`, `ROOT_DOMAIN`, `PLAN_LIMITS`, `RESERVED_SLUGS`) live in `lib/config.ts`. Never hardcode them elsewhere.
- Plan gating only through `can(plan, feature)`. Never scatter `if (plan === 'pro')` checks.
- UI: follow `DESIGN.md` strictly. Mobile-first, accessible (labels, focus states, contrast), loading + empty + error states for every data view. Never hardcode colors, fonts, radii or shadows; use the tokens (CSS variables / Tailwind theme). Run the design QA checklist (`DESIGN.md` section 19) after each screen.
- Prefer small pure functions with unit tests for: pricing calculation, coupon validation, plan limits, slug validation, drip logic.
- No `console.log` in committed code; use a logger and Sentry.
- **Creator customization guardrails** (D-013, D-014): sanitize and length-limit ALL creator text (store name, bio, product text, thank-you message, email subject and body, questions and options); never render raw HTML from a creator or a buyer. Email templates support only the variables `{{customer_name}}`, `{{product_title}}` and `{{download_link}}`. The sender identity and the download link are always included in emails, whatever the creator writes. No sensitive checkout questions (card or ID numbers); custom questions are text, long text, dropdown or checkbox, at most 5 per product. After-purchase redirect URLs must be `https`. CSV exports must neutralize spreadsheet formulas. Creators are the data controller for their buyers' data (stated in the Terms).

## 6. Database rules

- Data model changes go in `lib/db/collections.ts` (document types) and `lib/db/mongo.ts` (indexes). Uniqueness is enforced by unique indexes, never by check-then-insert. A change that needs existing documents rewritten needs a written migration script and the founder's approval.
- **MongoDB has no row-level security.** All database access goes through `/lib` data-access functions (for example `lib/stores/queries.ts`); components and routes never query collections directly. Every query on creator data filters by the owner id taken from the verified session (`requireCreator`), never from client input. Buyers see only their own enrollments and progress.
- Better Auth owns the `user`, `session`, `account` and `verification` collections; app code never writes to them directly.
- Public reads expose only public columns (no `stripe_account_id`, no Bunny video ids, no emails).
- `MONGODB_URI` and `BETTER_AUTH_SECRET` are server-only: used only in `lib/db/mongo.ts` and `lib/auth/auth.ts`, never imported by client components, never logged.
- Add a test for each new data-access function: creator A cannot read or write creator B's documents (the owner filter is applied).

## 7. Payments rules (CRITICAL)

The founder's platform Stripe account is **India-based**. Stripe documented these restrictions; violating them breaks the product.

**DO**
- Use **Standard** connected accounts via OAuth.
- Create Checkout Sessions as **direct charges** on the creator's account: pass `{ stripeAccount: store.stripe_account_id }`.
- Collect platform revenue only through **Stripe Billing subscriptions on the platform account**.
- Compute all prices, discounts and bump totals **server-side from the database**.
- Verify webhook signatures. Use **separate secrets** for the platform endpoint and the Connect endpoint.
- Make webhook handling **idempotent**: insert the event id into `webhook_events` first; if it already exists, return 200 and do nothing.
- Respond to webhooks fast; do heavy work (emails, enrollments follow-ups) in Inngest jobs.
- Use Stripe Checkout **dynamic payment methods** so creators in other countries can offer more methods. Verify the exact availability in the Stripe docs during the payments block; do not guess.
- A `MockProvider` is allowed **for development only**. It must refuse to run in production, and it must go through the same order and fulfilment path as Stripe: no shortcut that grants access without an order.
- Keep all payment-provider code inside `lib/payments/` behind a `PaymentProvider` interface (`createCheckout`, `handleWebhook`, `refund`). Build the Stripe adapter; the only other adapter allowed now is the development-only `MockProvider` (next bullet). Never import provider SDKs or types outside `lib/payments/`.

**DON'T**
- Do **not** set `application_fee_amount` or `application_fee_percent` anywhere.
- Do **not** use destination charges, `transfers`, `transfer_data`, separate charges and transfers, manual payouts, or cross-border payouts.
- Do **not** trust a price, amount, currency or coupon sent from the client.
- Do **not** store card data, ever. Stripe hosts the payment UI.
- Do **not** act as Merchant of Record or hold/forward creator funds. Creators are the seller of record for their own sales.
- Digital product files live in a **private** bucket and are delivered only through signed URLs (about 60 seconds) after an enrollment check.
- Do **not** grant course access based on the success redirect page; only the verified webhook creates enrollments.
- Do **not** enable the `MockProvider` in production, and do not let any provider skip the order and fulfilment path.

If a feature request seems to need an application fee or transfers, **stop and tell the founder** instead of working around the restriction.

## 8. Security checklist (apply to every task)

- [ ] Inputs validated with Zod; outputs minimal
- [ ] Authorization checked server-side (ownership/enrollment), not only hidden in UI (no IDOR)
- [ ] Every new query filters by the session owner id and has an ownership test
- [ ] No secrets in code, logs, client bundles or git history; `.env.example` lists variable names only
- [ ] Webhooks: signature verified, idempotent, safe to replay
- [ ] Rate limiting on login/OTP, checkout creation, coupon validation, playback-token endpoints
- [ ] Files and video served only via signed, expiring URLs/tokens; private storage buckets
- [ ] No raw SQL string concatenation; no `dangerouslySetInnerHTML` with user content (sanitize markdown)
- [ ] Redirect targets validated (no open redirects); OAuth `state` verified
- [ ] Error messages do not leak internals or whether an email exists
- [ ] Creator text sanitized and length-limited (no raw HTML); redirect URLs are https; no sensitive checkout questions; emails always carry the sender identity and the download link; CSV exports neutralize formulas
- [ ] `MockProvider` cannot run in production

After each milestone, run a self-review using this checklist and list any gaps in your report.

## 9. Environment variables (names only)

```
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_ROOT_DOMAIN
MONGODB_URI                          # server only
MONGODB_DB                           # server only, default "pickstall"
BETTER_AUTH_SECRET                   # server only
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   # server only
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
EMAIL_FROM                           # server only
ADMIN_EMAILS                         # server only (comma-separated emails allowed into /admin, D-104)
IP_HASH_SECRET                       # server only
STRIPE_SECRET_KEY                    # server only
STRIPE_PLATFORM_WEBHOOK_SECRET       # server only (webhook "Your account": plans, test-mode sales)
STRIPE_CONNECT_WEBHOOK_SECRET        # server only (webhook "Connected accounts": creators' sales)
STRIPE_CONNECT_CLIENT_ID             # Connect OAuth client id (ca_...)
STRIPE_PLATFORM_ACCOUNT_ID           # server only, test mode: our own account as a store's seller
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET   # server only (private bucket for product files, D-093)
BUNNY_STREAM_LIBRARY_ID              # server only
BUNNY_STREAM_API_KEY                 # server only
BUNNY_STREAM_TOKEN_KEY               # server only (signs playback links)
BUNNY_STREAM_READONLY_KEY            # server only (verifies Bunny webhooks)
RESEND_API_KEY                       # server only
RESEND_WEBHOOK_SECRET                # server only (verifies Resend bounce and complaint webhooks, D-095)
INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY   # server only (call reminders); INNGEST_DEV=1 for the local dev server
NEXT_PUBLIC_POSTHOG_KEY
SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN
SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT   # build only (source maps)
DEV_ALLOWED_HOSTS                    # development only
```
Use Stripe **test mode** keys until the founder says live mode is approved.

## 10. Testing expectations

- Unit tests: pricing + coupon math, plan gating, slug rules, drip rules.
- Integration tests: webhook idempotency (same event twice = one order, one enrollment), coupon redemption under concurrency, cross-tenant isolation (owner filter on every query), playback token denied for non-enrolled users.
- E2E (Playwright): creator signup -> create store -> add course -> (test mode) buy as student -> watch lesson.
- A task is **not done** until relevant tests exist and pass.

## 11. Definition of done

1. Works locally and `pnpm build` succeeds
2. Lint, typecheck and tests pass
3. Security checklist (section 8) reviewed
4. Loading, empty and error states handled; usable at 360px width
5. Migration files included for any schema change
6. Short report written: changes, how to test, known gaps

## 12. Out of scope until told otherwise

Affiliate payouts, application fees, marketplace, community, live classes, mobile app, WhatsApp automation, multi-language UI, physical products. See `PRD.md` backlog. Phase scope also applies: Phase 1 is digital products only. Courses, coupons, order bumps, platform billing and the growth tools arrive in later phases (`PRD.md` section 8.1 and section 12). Do not build them early.

## 13. First task template

When the founder says "start M0", do this: propose the plan, then set up the repo (Next.js + TypeScript strict + Tailwind + shadcn + ESLint + Vitest), the `.env.example`, `lib/config.ts`, CI workflow, and a README with run instructions. Do not touch Stripe, video or the database yet.
