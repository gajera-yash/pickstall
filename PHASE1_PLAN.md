# Phase 1 in 3 days: plan, Claude Code prompts, tests, go/no-go

> Put `PRD.md` and `CLAUDE.md` in the repo root. Start one fresh Claude Code session per block. Always ask for a plan first, approve it, then let it build. Commit after every block. The decisions behind this plan are in `docs/DECISIONS.md` (D-008 to D-018).

## 0. Reality check: what "Phase 1 in 3 days" can honestly mean

Three days is enough for a **working private alpha in Stripe test mode**. It is **not** enough for a public, real-money launch, for three reasons:

1. **Stripe India platform account is invite-only.** Until Stripe grants live access and Connect works, no real payment can happen. Check on day 0 whether test keys and Connect are available to you. If they are not, Day 2 can start with the development-only MockProvider (D-016).
2. **Payments, auth and RLS are where bugs hurt.** They need testing time and a security pass that does not fit in the same 72 hours as building.
3. **Legal pages** (Terms, Privacy, Refund) and a real $5 end-to-end sale must exist before taking anyone's money.

So define the 3-day goal as: **"A creator can sign up (email code or Google), get a reserved store link, set up the store and customize a digital product in the dashboard, connect Stripe (test mode), and a buyer can open /@username, answer the creator's checkout questions, pay (test card), get the confirmation email and download the file. Deployed on a real URL."** Then invite 3-5 founding creators to try it as a private alpha.

### Phase 1 scope (3 days)

| In (3 days) | Out (days 4-8, then later) |
|---|---|
| Login and 2-step signup (email code), Google sign-in, draft store reserved at signup | Video courses with Mux (days 4-6) |
| Dashboard: My Store, Income, Customers, Settings; first-run checklist (Store setup, Add first product, Connect payments, Publish) | Coupons and order bumps (days 6-7) |
| Store setup: name, avatar, bio, currency, theme, accent, link; public store page at `/@username` | Platform subscription billing (Phase 3, before the 6-month founding free period ends) |
| Product type picker (Digital product live; Course, Coaching call, Membership, Collect emails, Link shown as "Coming soon") | Custom domain, abandoned-cart emails |
| Digital products (file or external link): fixed or pay-what-you-want price, private file upload, product page at `/@username/product-slug` | Email marketing, funnels, AutoDM, community |
| Customization: button text, checkout headline, thank-you message, confirmation email subject and body with variables, download limit | Student progress, quizzes, certificates |
| Checkout fields: name and email, optional phone, up to 5 custom questions; answers stored per order | Analytics beyond the Income page |
| Stripe Connect Standard (test mode), or the dev-only MockProvider; checkout (direct charge, no application fee), dynamic payment methods | Course, Coaching call, Membership, Collect emails and Link product types |
| Webhook (idempotent), orders, enrollments, Customers panel with CSV export, buyer library at `/library`, signed downloads | |
| Confirmation email to the buyer, sale email to the creator | |
| Security pass, tests, Vercel deploy | |

> Why digital products first and courses after: courses need Mux uploads, webhooks, signed playback tokens, a player and progress tracking. That is a whole separate block. Digital delivery proves the whole money path (checkout, webhook, access) in the smallest surface.

## 1. Before you start (60-90 minutes, do today)

- [ ] Accounts: GitHub, Vercel, Supabase, Stripe (platform), Resend, PostHog (optional), Sentry (optional)
- [ ] Stripe: request the India invite via the sales form. Ask: are test keys and Connect (Standard, OAuth) available now? Install the **Stripe CLI** for local webhook forwarding.
- [ ] PayPal: submit the PayPal platforms/multiparty form as a backup if the Stripe invite is delayed. Build payments behind a `PaymentProvider` interface either way.
- [ ] Domain: `pickstall.store` (D-010), add to Vercel. **Verify the Resend sending domain now** (DNS propagation can take hours).
- [ ] Create `.env.local` from the variable names in `CLAUDE.md` section 9
- [ ] Deploy the existing `landing/index.html` (or the landing build) so the waitlist is already collecting emails while you build
- [ ] Install Supabase CLI and `pnpm`

## 2. Schedule

| Block | Time | Goal |
|---|---|---|
| A | Before Day 1 (done) | Repo, schema, RLS, auth foundations |
| B | Day 1, 0-3h | Login, 2-step signup, Google, dashboard shell, first-run checklist, store setup |
| C | Day 1, 3-8h | My Store products: type picker, digital product and customization; public store page at `/@username`, product page (Buy disabled) |
| D | Day 2, 0-5h | Stripe Connect (or MockProvider), checkout with creator fields, webhook, orders, Customers panel, buyer library, secure downloads |
| E | Day 2, 5-8h | Emails (confirmation with variables, creator notification) |
| F | Day 3 | Security review, more payment methods, deploy, smoke test, private alpha invites |

Reserve 20 percent of each block for fixing what Claude Code gets wrong. If a block runs over, **cut scope, not tests**.

## 3. Prompts (paste one per session)

### Block A: foundation, schema, auth (M0 + M1)
```
Read CLAUDE.md, then only the PRD.md and DESIGN.md sections listed for this block in the read map (CLAUDE.md section 1.1). We are doing a 3-day Phase 1 (see PHASE1_PLAN.md section 0 for scope). Do Block A only.

First reply with a short plan (files, approach, risks) and wait for my approval.

Then:
1. Set up Next.js (App Router, TypeScript strict), Tailwind, shadcn/ui, ESLint, Vitest, pnpm scripts from CLAUDE.md. Add .env.example (names only) and lib/config.ts (APP_NAME, ROOT_DOMAIN, PLAN_LIMITS, RESERVED_SLUGS).
2. Create Supabase migrations for ONLY these tables from PRD.md section 5.4: profiles, stores, products, product_files, orders, order_items, enrollments, webhook_events, email_log. Include the pricing_model, min_price_cents and download_limit columns. Add an owns_store(store_id) SQL helper.
3. Enable RLS on every table with explicit policies per PRD section 5.5. Public reads expose only public columns through views. Service-role writes only for webhook_events and email_log.
4. Auth: email OTP and Google via Supabase Auth, a trigger that creates profiles, and requireCreator and requireUser guards in lib/auth.
5. Write RLS tests: creator A cannot read or write creator B's stores, products, orders or enrollments; an anonymous user cannot read orders or enrollments.
Run lint, typecheck and tests. Report what you did and what is missing.
```

### Block B: login, signup, dashboard (M2)
```
Do Block B only. Plan first, wait for approval. If docs/ui-reference/ has an image for the screen you are building, read that one image only.

1. Login: 6-digit email code and Google. Signup in 2 steps: details (username, full name, email, optional phone), then the code, then straight to /dashboard. No store setup, activation page or billing steps in signup (D-008). Validate with Zod. Same response whether or not the email exists.
2. A draft (unpublished) store is created on the server right after the code is verified, using the username as slug. Re-check the username there (do not trust client-editable auth metadata); sign-in must still succeed if it was taken. New Google users get one extra step to choose a username (optional phone). Buyers never use signup.
3. Dashboard shell with four sections: My Store, Income, Customers, Settings (D-011), and the first-run checklist: Store setup, Add first product, Connect payments, Publish (D-009). Empty states with one clear action.
4. Store setup in My Store: name, avatar (public bucket, image types and size limits validated), bio, currency (usd, gbp, cad), theme preset, accent color with the contrast guard, link.
5. Unit tests for slug validation and text sanitizing. Run lint, typecheck, tests.
```

### Block C: products, customization and the public store page (M2 + M3-lite)
```
Do Block C only. Plan first, wait for approval.

1. Product type picker backed by a type registry (D-012): Digital product (file or external link) is live; Course, Coaching call, Membership, Collect emails and Link show a "Coming soon" badge and cannot be selected.
2. Product CRUD (type = digital) with title, slug, description, cover image, status (draft/published), pricing_model (fixed or pwyw), price_cents or min_price_cents, optional download_limit. Validate with Zod. Ownership check on every mutation.
3. Customization (D-013): button text, checkout headline, thank-you message, confirmation email subject and body with the variables {{customer_name}}, {{product_title}}, {{download_link}}; checkout fields: name and email always required, an optional phone toggle, up to 5 custom questions (text, long text, dropdown, checkbox, required flag).
4. The schema additions for step 3 (products.settings jsonb, product_checkout_fields table, orders.answers jsonb, customers table; D-015) need my approval BEFORE you write the migrations. Each gets RLS and a test that creator A cannot see creator B's rows. Public views must expose only whitelisted settings keys.
5. Guardrails (D-014): sanitize and length-limit all creator text, no raw HTML; the sender identity and the download link are always in emails; no sensitive questions (card or ID numbers); after-purchase redirect URLs must be https.
6. Private file upload to a PRIVATE Supabase Storage bucket: allowed types and max size from config, store only storage_path in product_files, never a public URL.
7. Public URLs are path-based on one domain (D-010): /@username and /@username/product-slug, implemented with next.config rewrites to /s/:username (NOT an app/@username folder, which would be a parallel route). No subdomain routing.
8. Public store page: server-rendered, mobile-first at 360px, avatar, name, bio, links, product cards, 3 theme presets stored in stores.theme. Sanitize all creator text (no raw HTML). Do not expose private columns.
9. Product page at /@username/product-slug: cover, description, price (or a pay-what-you-want input with min), the creator's button text and checkout headline, and a Buy button (disabled until payments are connected for the store).
10. Guard: a store cannot publish a paid product without stripe_charges_enabled (the development-only MockProvider may report it as connected).
11. Tests: the rewrite mapping, pwyw minimum validation, slug uniqueness per store, a non-owner cannot edit a product, file paths are never returned to the public, at most 5 custom questions, redirect URLs must be https, only the three allowed email variables are supported, creators only see their own settings and fields (RLS).
Run lint, typecheck, tests.
```

### Block D: payments, checkout, webhook, customers, library (M5 + M6)
```
Do Block D only. Re-read CLAUDE.md section 7 (payments rules). Plan first, wait for approval.

HARD RULES: Standard connected accounts via OAuth; direct charges with the { stripeAccount } option; NEVER application_fee_amount, transfers, destination charges or payouts. Everything provider-specific lives in lib/payments/ behind a PaymentProvider interface (createCheckout, handleWebhook, refund). The Stripe adapter is the real one. A MockProvider is allowed for development only: it must refuse to run in production and must go through the same order and fulfilment path as Stripe (never a shortcut that grants access without an order). Use Stripe Checkout dynamic payment methods and verify their exact availability in the Stripe docs; do not guess. Do not build a PayPal adapter now.

1. Connect OAuth: signed, user-bound state; callback stores stripe_account_id; handle deauthorization; refresh stripe_charges_enabled from the account.updated webhook.
2. POST /api/checkout: Zod validate (productId, email, name, optional phone, optional pwyw amount, answers to the product's custom questions). Load the product and its checkout fields from the DB, enforce required questions and types on the server, recompute the price server-side (pwyw: amount >= min and <= a sane max; answers can never change the price), create the orders row (pending) with the answers, create a Checkout Session on the connected account with metadata (order_id, store_id), return the URL. Rate limit this route.
3. Webhook /api/webhooks/stripe-connect: verify the signature with STRIPE_CONNECT_WEBHOOK_SECRET; insert the event id into webhook_events first and return 200 if it already exists (idempotent); on checkout.session.completed mark the order paid, create or find the buyer profile by email, create the enrollment, upsert the customers row (store_id, email, name, phone), queue emails; on charge.refunded mark refunded and set enrollments.revoked_at.
4. Never grant access from the success redirect page, only from the verified webhook.
5. Buyer library at /library: email-code sign-in (buyers never use signup), list purchases, download route that checks enrollment (not revoked, download_limit respected) and returns a signed URL valid for about 60 seconds.
6. Customers panel in the dashboard: buyers with email, name, optional phone, purchase date and their answers; CSV export with spreadsheet formulas neutralized.
7. Tests: same webhook event twice creates one order, one enrollment and one customer row; tampered price or answers in the request body cannot change the price; a missing required answer is rejected; a non-buyer cannot get a download URL; refund revokes access; creator A cannot see creator B's customers or answers; the MockProvider refuses to run in production.
Use the Stripe CLI (stripe listen --forward-to ...) to test locally. Run lint, typecheck, tests.
```

### Block E: emails
```
Do Block E only. Plan first, wait for approval.

Phase 1 exception to CLAUDE.md: instead of Inngest, use an email_outbox table (id, to_email, template, payload, status, attempts, created_at, sent_at) plus a protected Vercel Cron route that sends queued emails through Resend with retry and logs to email_log. The webhook only inserts into email_outbox.

Templates (React Email, plain and branded): the buyer confirmation with an access link to the library, and the creator sale notification. The confirmation uses the creator's subject and body for that product, with the variables {{customer_name}}, {{product_title}} and {{download_link}}; the text is sanitized (no raw HTML). The sender identity, the footer with a physical address placeholder and the download link are ALWAYS included, even if the creator's text leaves them out (D-014). Use a verified sending domain. Tests: the webhook enqueues exactly one confirmation per order even when the event is delivered twice; the download link is present when the creator's body omits it; creator text cannot inject HTML.
```

### Block F: security review, more payment methods, deploy, smoke test
```
Do Block F only (Day 3).

1. Review the entire codebase against the checklist in CLAUDE.md section 8. List findings by severity and fix critical and high ones. Specifically check: RLS on every table (including the D-015 tables), IDOR on every route and action, webhook signature and idempotency, open redirects (including the creator's after-purchase redirect URL), XSS in creator text and custom answers, CSV export formula injection, secrets in client bundles, public storage paths, missing rate limits, and that the MockProvider cannot run in production.
2. Enable more Stripe payment methods through dynamic payment methods, after verifying availability in the Stripe docs.
3. Add security headers and a basic CSP in next.config.
4. Add Sentry error reporting and a minimal PostHog set of events (optional).
5. Deploy to Vercel with env vars. Register the Connect and platform webhook endpoints in the Stripe dashboard (test mode) and note the secrets I need to set.
6. Write a README with run, test and deploy instructions, and a docs/SMOKE_TEST.md with the manual test script from PHASE1_PLAN.md section 4.
Run the full test suite and report.
```

## 4. Manual smoke test (do this yourself, not Claude Code)

1. Sign up as **Creator A** (incognito window 1) with username, name, email and the code. You land on /dashboard and the link is reserved. Repeat once with Google as a new user: it asks for a username.
2. In My Store, finish Store setup. Open `/@username` on mobile width: the store page loads.
3. Add a digital product from the type picker (the other types show "Coming soon"). Customize it: button text, checkout headline, thank-you message, confirmation email text with variables. Turn on the phone toggle and add 2 custom questions (one required). Upload a file. Connect Stripe (test mode), or use the MockProvider. Publish.
4. As an **anonymous buyer** (incognito window 2): open `/@username/product-slug`, answer the questions, buy with test card `4242 4242 4242 4242`. Confirm the confirmation email arrives with the creator's text and the download link, and /library shows the file.
5. Download works. Try the same download URL after 2 minutes: it must fail.
6. In the dashboard Customers panel, the buyer appears with email, name, phone and answers. Export the CSV and open it in a spreadsheet: no cell runs as a formula.
7. Pay-what-you-want: try an amount below the minimum (must be rejected). Try to buy without answering the required question (must be rejected).
8. Replay the webhook (`stripe events resend <id>`): there must still be exactly one order, one enrollment and one customer row.
9. Issue a refund from the Stripe dashboard: access must be revoked.
10. **Cross-tenant test:** log in as Creator B. Try to open Creator A's product edit URL, order URLs and Customers data by ID. All must fail.
11. Open the store on a 360px phone and in dark mode. Check keyboard navigation on the checkout button.

## 5. Go / no-go

**Private alpha (Stripe test mode): go when all of these pass**
- [ ] Smoke test steps 1-11 pass
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

## 6. After day 3 (so the roadmap stays honest)

| Days | Work |
|---|---|
| 4-6 | Courses: modules and lessons, Mux upload, signed playback, student player with progress |
| 6-7 | Coupons, order bumps |
| Weeks 2-4 | Growth tools (lead magnets, email marketing, abandoned cart, pixels, upsells, custom domain, import tools), then platform billing with plan limits. Billing must be live before the 6-month founding free period ends. Full roadmap: `PRD.md` section 12 |
| Week 2 | Legal pages, hardening, real $5 test, founding creators onboarded personally |

## 7. Working tips for Claude Code

- One block per session. Start each with: "Read CLAUDE.md and the read map for this block only. Do Block X only. Plan first." Use /clear (or a new session) between blocks.
- Review diffs of auth, RLS and payment files yourself. Do not accept them blindly.
- If it adds an unrequested dependency or touches files outside the block, stop it.
- When something breaks, give it the exact error and ask for the root cause before fixes.
- Never paste real secrets into prompts. Keep `.env.local` out of git.
- UI reference images live in `docs/ui-reference/`, named by screen. Read only the one image for the screen you are building.
- If a block is running long, cut features (not tests, not security).
