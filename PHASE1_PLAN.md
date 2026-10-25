# Phase 1 in 2 days: plan, Claude Code prompts, tests, go/no-go

> Put `PRD.md` and `CLAUDE.md` in the repo root. Start one fresh Claude Code session per block. Always ask for a plan first, approve it, then let it build. Commit after every block.

## 0. Reality check: what "Phase 1 in 2 days" can honestly mean

Two days is enough for a **working private alpha in Stripe test mode**. It is **not** enough for a public, real-money launch, for three reasons:

1. **Stripe India platform account is invite-only.** Until Stripe grants live access and Connect works, no real payment can happen. Check on day 0 whether test keys and Connect are available to you.
2. **Payments, auth and RLS are where bugs hurt.** They need testing time and a security pass that does not fit in the same 48 hours as building.
3. **Legal pages** (Terms, Privacy, Refund) and a real $5 end-to-end sale must exist before taking anyone's money.

So define the 2-day goal as: **"A creator can sign up, create a store, add a digital product, connect Stripe (test mode), and a buyer can pay (test card), get an email, and download the file. Deployed on a real URL."** Then invite 3-5 founding creators to try it as a private alpha.

### Phase 1 scope (2 days)

| In (2 days) | Out (days 3-7, then later) |
|---|---|
| Auth (email OTP + Google), onboarding wizard | Video courses with Mux (days 3-5) |
| Dashboard shell, store settings, public store page | Coupons and order bumps (day 5-6) |
| Digital products: create, edit, publish, private file upload | Platform subscription billing (Phase 3, before the 6-month founding free period ends) |
| Pay-what-you-want and fixed price | Custom domain, abandoned-cart emails |
| Stripe Connect Standard (test mode), checkout (direct charge, no application fee) | Email marketing, funnels, AutoDM, community |
| Webhook (idempotent), orders, enrollments, buyer library, signed downloads | Student progress, quizzes, certificates |
| Receipt email to buyer, sale email to creator | Analytics beyond basic order list |
| Security pass, tests, Vercel deploy | |

> Why digital products first and courses after: courses need Mux uploads, webhooks, signed playback tokens, a player and progress tracking. That is a whole separate block. Digital delivery proves the whole money path (checkout, webhook, access) in the smallest surface.

## 1. Before you start (60-90 minutes, do today)

- [ ] Accounts: GitHub, Vercel, Supabase, Stripe (platform), Resend, PostHog (optional), Sentry (optional)
- [ ] Stripe: request the India invite via the sales form. Ask: are test keys and Connect (Standard, OAuth) available now? Install the **Stripe CLI** for local webhook forwarding.
- [ ] PayPal: submit the PayPal platforms/multiparty form as a backup if the Stripe invite is delayed. Build payments behind a `PaymentProvider` interface either way.
- [ ] Domain: buy it, add to Vercel. **Verify the Resend sending domain now** (DNS propagation can take hours).
- [ ] Create `.env.local` from the variable names in `CLAUDE.md` section 9
- [ ] Deploy the existing `landing/index.html` (or the landing build) so the waitlist is already collecting emails while you build
- [ ] Install Supabase CLI and `pnpm`

## 2. Schedule

| Block | Time | Goal |
|---|---|---|
| A | Day 1, 0-2.5h | Repo, schema, RLS, auth |
| B | Day 1, 2.5-5h | Onboarding, dashboard shell, public store |
| C | Day 1, 5-8h | Digital products, private upload, product page |
| D | Day 2, 0-3.5h | Stripe Connect, checkout, webhook, library, downloads |
| E | Day 2, 3.5-5h | Emails (receipt + creator notification) |
| F | Day 2, 5-8h | Security review, tests, deploy, smoke test, private alpha invites |

Reserve 20 percent of each block for fixing what Claude Code gets wrong. If a block runs over, **cut scope, not tests**.

## 3. Prompts (paste one per session)

### Block A: foundation, schema, auth (M0 + M1)
```
Read CLAUDE.md, then only the PRD.md and DESIGN.md sections listed for this block in the read map (CLAUDE.md section 1.1). We are doing a 2-day Phase 1 (see PHASE1_PLAN.md section 0 for scope). Do Block A only.

First reply with a short plan (files, approach, risks) and wait for my approval.

Then:
1. Set up Next.js (App Router, TypeScript strict), Tailwind, shadcn/ui, ESLint, Vitest, pnpm scripts from CLAUDE.md. Add .env.example (names only) and lib/config.ts (APP_NAME, ROOT_DOMAIN, PLAN_LIMITS, RESERVED_SLUGS).
2. Create Supabase migrations for ONLY these tables from PRD.md section 5.4: profiles, stores, products, product_files, orders, order_items, enrollments, webhook_events, email_log. Include the pricing_model, min_price_cents and download_limit columns. Add an owns_store(store_id) SQL helper.
3. Enable RLS on every table with explicit policies per PRD section 5.5. Public reads expose only public columns through views. Service-role writes only for webhook_events and email_log.
4. Auth: email OTP and Google via Supabase Auth, a trigger that creates profiles, and requireCreator and requireUser guards in lib/auth.
5. Write RLS tests: creator A cannot read or write creator B's stores, products, orders or enrollments; an anonymous user cannot read orders or enrollments.
Run lint, typecheck and tests. Report what you did and what is missing.
```

### Block B: onboarding, dashboard, public store (M2)
```
Do Block B only. Plan first, wait for approval.

1. Onboarding wizard: store name, slug (validate ^[a-z0-9-]{3,30}$, reject RESERVED_SLUGS, check uniqueness server-side), bio, avatar upload (public bucket, image types and size limits validated), currency (usd, gbp, cad).
2. Dashboard shell: left nav (Overview, Products, Orders, Settings, Stripe), an onboarding checklist (Connect Stripe, Add first product, Publish store), empty states with one clear action.
3. Middleware for multi-tenant routing: {slug}.ROOT_DOMAIN and the /s/[slug] fallback for local dev.
4. Public store page: server-rendered, mobile-first at 360px, avatar, name, bio, product cards, 3 theme presets stored in stores.theme. Sanitize all user text. Do not expose private columns.
5. Unit tests for slug validation and tenant resolution. Run lint, typecheck, tests.
```

### Block C: digital products (M3-lite)
```
Do Block C only. Plan first, wait for approval.

1. Product CRUD (type = digital only) with title, slug, description, cover image, status (draft/published), pricing_model (fixed or pwyw), price_cents or min_price_cents, optional download_limit. Validate with Zod. Ownership check on every mutation.
2. Private file upload to a PRIVATE Supabase Storage bucket: allowed types and max size from config, store only storage_path in product_files, never a public URL.
3. Product page at /s/[slug]/[productSlug]: cover, description, price (or a pay-what-you-want input with min), a Buy button (disabled until Stripe is connected for the store).
4. Guard: a store cannot publish a paid product without stripe_charges_enabled.
5. Tests: pwyw minimum validation, slug uniqueness per store, a non-owner cannot edit a product, file paths are never returned to the public.
Run lint, typecheck, tests.
```

### Block D: Stripe Connect, checkout, webhook, library (M5 + M6)
```
Do Block D only. Re-read CLAUDE.md section 7 (payments rules). Plan first, wait for approval.

HARD RULES: Standard connected accounts via OAuth; direct charges with the { stripeAccount } option; NEVER application_fee_amount, transfers, destination charges or payouts. Everything provider-specific lives in lib/payments/ behind a PaymentProvider interface (createCheckout, handleWebhook, refund) with a Stripe adapter only. Do not build a PayPal adapter now.

1. Connect OAuth: signed, user-bound state; callback stores stripe_account_id; handle deauthorization; refresh stripe_charges_enabled from the account.updated webhook.
2. POST /api/checkout: Zod validate (productId, email, optional pwyw amount). Load product from DB, recompute the price server-side (pwyw: amount >= min and <= a sane max), create the orders row (pending), create a Checkout Session on the connected account with metadata (order_id, store_id), return the URL. Rate limit this route.
3. Webhook /api/webhooks/stripe-connect: verify the signature with STRIPE_CONNECT_WEBHOOK_SECRET; insert the event id into webhook_events first and return 200 if it already exists (idempotent); on checkout.session.completed mark the order paid, create or find the buyer profile by email, create the enrollment, queue emails; on charge.refunded mark refunded and set enrollments.revoked_at.
4. Never grant access from the success redirect page, only from the verified webhook.
5. Buyer library: email-OTP sign-in, list purchases, download route that checks enrollment (not revoked, download_limit respected) and returns a signed URL valid for about 60 seconds.
6. Tests: same webhook event twice creates one order and one enrollment; tampered price in the request body is ignored; a non-buyer cannot get a download URL; refund revokes access.
Use the Stripe CLI (stripe listen --forward-to ...) to test locally. Run lint, typecheck, tests.
```

### Block E: emails
```
Do Block E only. Plan first, wait for approval.

Phase 1 exception to CLAUDE.md: instead of Inngest, use an email_outbox table (id, to_email, template, payload, status, attempts, created_at, sent_at) plus a protected Vercel Cron route that sends queued emails through Resend with retry and logs to email_log. The webhook only inserts into email_outbox.

Templates (React Email, plain and branded): buyer receipt with an access link to the library, and creator sale notification. Footer with sender identity and physical address placeholder. Use a verified sending domain. Add a test that the webhook enqueues exactly one receipt per order even when the event is delivered twice.
```

### Block F: security review, deploy, smoke test
```
Do Block F only.

1. Review the entire codebase against the checklist in CLAUDE.md section 8. List findings by severity and fix critical and high ones. Specifically check: RLS on every table, IDOR on every route and action, webhook signature and idempotency, open redirects, XSS in user-supplied text, secrets in client bundles, public storage paths, missing rate limits.
2. Add security headers and a basic CSP in next.config.
3. Add Sentry error reporting and a minimal PostHog set of events (optional).
4. Deploy to Vercel with env vars. Register the Connect and platform webhook endpoints in the Stripe dashboard (test mode) and note the secrets I need to set.
5. Write a README with run, test and deploy instructions, and a docs/SMOKE_TEST.md with the manual test script from PHASE1_PLAN.md section 4.
Run the full test suite and report.
```

## 4. Manual smoke test (do this yourself, not Claude Code)

1. Sign up as **Creator A** (incognito window 1). Complete onboarding. Confirm the slug and store page load on mobile width.
2. Connect Stripe (test mode). Create a fixed-price product ($10) with a file. Publish.
3. As an **anonymous buyer** (incognito window 2): open the store, buy with test card `4242 4242 4242 4242`. Confirm the receipt email arrives and the library shows the file.
4. Download works. Try the same download URL after 2 minutes: it must fail.
5. Pay-what-you-want: try an amount below the minimum (must be rejected).
6. Replay the webhook (`stripe events resend <id>`): there must still be exactly one order and one enrollment.
7. Issue a refund from the Stripe dashboard: access must be revoked.
8. **Cross-tenant test:** log in as Creator B. Try to open Creator A's product edit URL and order URLs by ID. All must fail.
9. Open the store on a 360px phone and in dark mode. Check keyboard navigation on the checkout button.

## 5. Go / no-go

**Private alpha (Stripe test mode): go when all of these pass**
- [ ] Smoke test steps 1-9 pass
- [ ] RLS and webhook tests green in CI
- [ ] Deployed on your domain, HTTPS, webhooks registered
- [ ] You invited 3-5 founding creators and told them honestly it is an early test version with no real payments yet

**Public launch with real money: do NOT launch until all of these pass**
- [ ] Stripe live access granted, Connect live, live webhook secrets set
- [ ] One real $5 purchase on a real connected account, then refunded
- [ ] Terms, Privacy and Refund pages live, cookie banner for EU/UK
- [ ] Independent review of auth, RLS and payment code by an experienced developer
- [ ] Monitoring (Sentry) and a way for creators to reach you quickly
- [ ] CA consulted on export-of-services income and INR payouts

## 6. After day 2 (so the roadmap stays honest)

| Days | Work |
|---|---|
| 3-5 | Courses: modules and lessons, Mux upload, signed playback, student player with progress |
| 5-6 | Coupons, order bumps |
| Weeks 2-4 | Growth tools (lead magnets, email marketing, abandoned cart, pixels, upsells, custom domain, import tools), then platform billing with plan limits. Billing must be live before the 6-month founding free period ends. Full roadmap: `PRD.md` section 12 |
| Week 2 | Legal pages, hardening, real $5 test, founding creators onboarded personally |

## 7. Working tips for Claude Code

- One block per session. Start each with: "Read CLAUDE.md and the read map for this block only. Do Block X only. Plan first." Use /clear (or a new session) between blocks.
- Review diffs of auth, RLS and payment files yourself. Do not accept them blindly.
- If it adds an unrequested dependency or touches files outside the block, stop it.
- When something breaks, give it the exact error and ask for the root cause before fixes.
- Never paste real secrets into prompts. Keep `.env.local` out of git.
- If a block is running long, cut features (not tests, not security).
