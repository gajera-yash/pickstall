# PRD: Pickstall (v2.0, final)

> Owner: founder (solo, building with Claude Code). Last updated: 2026-10-29.
> Stack: Next.js + Node.js + MongoDB (Atlas) + AWS. Design system: `DESIGN.md`. Database field-level spec: `docs/DATABASE.md`. Architecture and scaling: `ARCHITECTURE.md`. Working rules: `CLAUDE.md`.
> **How to use this file:** it describes the whole product and, in section 8, exactly what is still to build. Do not rebuild what already works. First audit the code against this file (section 0), then build the remaining blocks in order.

---

## 0. Current status and instructions for Claude Code

**Done (verify in code, do not rewrite):**
- MongoDB foundation, repositories, config, env validation.
- Login (email 6-digit code) and signup (2 steps: details, then email code), draft store created at signup, user lands in `/dashboard`.
- White theme foundation.

**Remaining (this PRD):** dashboard shell and store setup, files/S3, products (digital) with full customization, public store and product pages at `/@username`, payments (provider layer, MockProvider, Stripe Connect), checkout with creator-defined fields, webhook and orders pipeline, Customers panel, Income, buyer library with secure downloads, emails, security review, AWS deploy. Then Phases 2 to 5.

**First task, before any code:** audit the repo against this PRD and `docs/DATABASE.md`. Report (1) what exists and matches, (2) what exists but differs (names, fields, routes), (3) what is missing, (4) contradictions in the docs. **Existing working code and names win** unless they violate a security rule here; propose changes instead of rewriting. Then wait for approval and build block by block (section 8).

---

## 1. Summary

Pickstall is a no-code platform where creators open a mobile-first store at **`pickstall.store/@username`**, sell digital products (and later courses, memberships, coaching calls), take payments in their own payment account, and see their customers and income in one dashboard. **0% transaction fees**: Pickstall never takes a cut of sales; it earns from a flat monthly plan. Stripe's card processing fees still apply to creators.

**Positioning:** "Stan Store + Gumroad in one place. Stan's pro features at a lower price. Everything customizable by the creator."

**Audience:** course creators and digital-product sellers selling to customers in the US, UK and Canada; creators in other countries can connect where the payment provider supports them.

**Principles:** money is the hero (clear, honest fees); mobile-first; one primary action per screen; creators can customize almost everything, within safe limits; honest UI (no fake proof).

### 1.1 Goals (first 90 days of beta)
10 to 15 founding creators onboarded (10 free spots for 6 months, personal setup); 70% publish a store; 40% get a first sale; 5+ paying after the free period; no critical bug open longer than 48 hours.

### 1.2 Non-goals (Phase 1)
Courses with video, coupons, order bumps, email marketing, funnels, memberships, bookings, affiliates, community, AutoDM, custom domains, import tools, platform billing, mobile app, multi-language UI, physical products, Merchant of Record, application fees.

---

## 2. HARD CONSTRAINTS

1. **Payments:** the founder's payment platform account is India-based. Use Stripe **Connect Standard** (OAuth) with **direct charges** on the creator's connected account. **Never** set an application fee; do not use destination charges, transfers, standalone transfers, manual payouts or cross-border payouts. The India account is invite-only; live mode needs approval. Until then use test mode or the MockProvider.
2. **Not a Merchant of Record.** Creators are the seller of record: they handle their own tax, VAT/GST and disputes. Never claim tax handling in product or marketing. Creators are the data controllers of their buyers' data (state this in Terms and in the checkout-fields editor).
3. **Access is granted only by a verified payment webhook**, never by a success redirect.
4. **Provider-agnostic payments:** all payment code is behind a `PaymentProvider` interface (`createCheckout`, `handleWebhook`, `refund`) inside `lib/payments/`. Adapters: **Stripe** (first), **MockProvider** (development only, hard-disabled when `NODE_ENV=production`), PayPal (later, if approved).
5. **No Row Level Security on MongoDB:** tenant isolation is enforced by the repository layer (section 5.5). This is a security-critical rule.
6. **Honesty rules:** no fake testimonials, counts or logos. Demo data is labelled "Example". Every "0%" claim sits near "Stripe's card processing fees still apply". Features not shipped are tagged "Coming soon".
7. **Subscriptions as direct charges** (memberships) and **installments** are unverified for an India platform: confirm with the provider before building (Phase 4). **Affiliate payouts cannot be automated**; tracking only.

---

## 3. Personas

- **Creator:** signs up, sets up a store in minutes, adds products, customizes everything, connects payments, shares one link, sees customers and income.
- **Buyer:** opens a store link on a phone, buys in under a minute, receives an email, signs in with an email code, downloads from the library.
- **Owner (founder):** sees creators, plans and basic health in an admin page (later phase).

---

## 4. Features

Priority: **P0** Phase 1 (build now), **P1** Phase 2-3, **P2** Phase 4-5.

### F1. Auth and signup (DONE, verify) (P0)
- Signup: step 1 details (username, full name, email, optional phone) stored server-side in `signup_intents` (TTL 30 min); step 2 six-digit email code; on success create the user and the **draft (unpublished) store** (slug = username, name = full name, currency USD) and go to `/dashboard`.
- Login: email code. Same response whether or not the email exists. Resend cooldown 30 s; 5 wrong attempts lock the code.
- Google sign-in: new Google users choose a username (optional phone) before the draft store is created. If not yet built, add it in block R1.
- Buyers use the same email-code sign-in at checkout and in `/library`; they never see the signup page.
- If the username is taken at creation time, keep the verified session and send the user to "Choose another username". The unique index on `stores.slug` is the final authority.
- **Acceptance:** username validated server-side (`^[a-z0-9-]{3,30}$`, reserved list rejected); no account enumeration; sessions are `httpOnly`, `Secure`, `SameSite=Lax`.

### F2. Storefront at `/@username` (P0)
- Public URL `pickstall.store/@username` (path-based, one domain). Implement with `next.config` rewrites from `/@:username` to an internal route (an `app/@...` folder is a parallel route in Next.js and cannot be used).
- Content: avatar, name, bio, social links, product cards (cover, title, price, **creator-defined button text**), footer "Powered by Pickstall".
- Themes: Clean, Bold, Soft + accent color with a contrast guard (see `DESIGN.md` section 11). Draft stores are not publicly visible (404 for the public; owner sees a preview banner).
- Server-rendered and cached (static generation with on-demand revalidation when the creator edits); only public fields exposed (never payment account ids).
- **Acceptance:** loads under 2.5 s LCP on 4G at 360 px; unpublished store returns 404 to the public; theme and button text render exactly as configured.

### F3. Product types, picker and editor (P0)
- **Type registry:** each product type is a module (Zod schema for `typeData`, editor form definition, checkout and delivery handler, public rendering). Adding a type means adding a module and one registry line.
- **Live in Phase 1:** Digital product (uploaded file or external link). **Coming soon (tagged, not selectable):** Course (Phase 2), Coaching call, Membership, Collect emails, Link.
- Add product opens a **type picker**, then the editor.
- **Digital product editor tabs:** *Details* (title, description, cover, file or external link, price fixed or pay-what-you-want with minimum, button text), *Checkout* (F11), *After purchase* (F11), *Settings* (slug, download limit, status draft/published/archived).
- Pay-what-you-want: `amountMinor` is the suggested price, `minAmountMinor` the minimum, max from config `PWYW_MAX_CENTS` (default 50000). Server validates every amount.
- Publish rules: store connected for payments (or MockProvider in dev), product has a file or an `externalUrl`, price valid, title present.
- My Store lists products with cover, title, type badge, price, status toggle, drag to reorder, duplicate, archive.
- **Acceptance:** non-owners cannot read or edit; `externalUrl` and file keys never appear in public responses; every text field sanitized and length-limited.

### F3b. Digital delivery (P0)
- Files stored in a **private S3 bucket**; metadata in `files`. Downloads only through **presigned URLs (about 60 seconds)** issued after an entitlement check; `downloadCount` incremented atomically and `downloadLimit` enforced. External-link products reveal the link only inside the buyer library after purchase.
- Allowed file types and max size from config; server validates MIME and size; no public bucket paths.

### F4. Product page and checkout (P0)
- Product page at `/@username/product-slug`: cover, title, description, price (or pay-what-you-want input), creator button text, sticky buy button on mobile.
- Checkout page: creator headline, name and email (always), optional phone, creator's custom questions (F11), order summary (with "Platform fee $0.00" line), payment methods, "Paid securely via Stripe" line.
- Flow: `POST /api/checkout` validates input with strict Zod, loads product and store, **recomputes the price server-side**, creates a `pending` order with a snapshot of the product, creates a provider checkout (Stripe Checkout Session as a direct charge, no application fee) and returns the URL.
- **More payment methods:** use Stripe Checkout dynamic payment methods so creators in other countries can offer more methods; which are available depends on the creator's country, currency and Stripe settings (verify in Stripe docs during the payments block).
- **Acceptance:** tampered prices are ignored; answers validated against the field definitions; creators without connected payments cannot publish paid products; rate limited.

### F5. Coupons (Phase 2), F6. Order bump (Phase 2)
Described in `docs/DATABASE.md` (`coupons`, `coupon_redemptions`, `products.bump`). Not in Phase 1.

### F7. Transactional email (P0)
- Provider: Resend (queued, retry, `email_log`). Templates: buyer receipt (with library link), creator sale notification, login code.
- Creator-customizable confirmation email: subject and body with variables `{{customer_name}}`, `{{product_title}}`, `{{download_link}}`. Sender identity, library/download link and a physical-address footer are **always included** and cannot be removed.
- Creator can send themselves a test email.
- **Acceptance:** emails sent by the worker/outbox, never inline in the webhook; duplicates impossible when a webhook is replayed.

### F8. Creator dashboard (P0)
- **Shell:** left sidebar (My Store, Income, Customers, Settings), top bar (breadcrumb, "View my store", account menu). White theme per `DESIGN.md`.
- **First-run checklist:** Store setup, Add first product, Connect payments, Publish store; shows the store link with Copy.
- **Store setup (inside the dashboard):** store name, avatar, bio, social links, currency (USD, GBP, CAD), theme, accent, link display with **Change** (username change rules: uniqueness, rate limited, old link stops working in Phase 1).
- **My Store:** tabs *Products* and *Page design* (Page design is theme and accent in Phase 1; block editor later).
- **Income:** today, 7 days, 30 days revenue, orders, average order, chart, recent orders; data from `store_stats_daily`.
- **Customers:** see F12.
- **Settings:** Store, Payments (connect/disconnect, status, test mode badge, payment-methods note), Account (name, email, phone, sign out, delete account request).
- **Acceptance:** every query scoped by `storeId` through repositories; loading, empty, error and populated states everywhere.

### F9. Platform billing (Phase 3)
Founding creators free for 6 months, so no billing in Phase 1-2. Provider decided in Phase 3 (Stripe Billing if approved, or a Merchant of Record such as Dodo Payments). Plan limits through one `can(plan, feature)` helper.

| Plan | Price (placeholder) | Includes |
|---|---|---|
| Founding (10 spots) | Free for 6 months | Pro features, personal setup |
| Starter | $19/mo | Unlimited digital products, up to 5 courses, 20 h video, 1,000 subscribers, coupons, order bumps, lead magnets, pixels |
| Pro | $39/mo | Unlimited courses, 100 h video, 10,000 subscribers, upsells, funnels, payment plans, memberships, bookings, affiliates, custom domain, quizzes, automations |
| Business | $79/mo | 300 h video, 50,000 subscribers, A/B tests, attribution, API, team seats, priority support |

All plans: 0% transaction fee. Limits are placeholders until video and email costs are checked.

### F10. Legal (P0 before real money)
Terms, Privacy Policy, Refund policy template, cookie banner (GDPR/UK GDPR/CCPA), account deletion and data export, CAN-SPAM/CASL compliance for any marketing email.

### F11. Creator customization (P0, core differentiator)
Creators customize, within limits:
- **Store:** name, photo, bio, links, theme preset, accent color (contrast guard).
- **Product:** title, description, cover, price model, **button text** (store card and product page), download limit.
- **Checkout page:** headline; name and email always required; phone toggle; **up to 5 custom questions** (kinds: text, long text, dropdown, checkbox; required flag; options for dropdown). Show a note: "Answers appear in your Customers tab. Don't ask for card numbers or ID numbers."
- **After purchase:** thank-you message, optional https redirect URL, confirmation email subject and body (F7).
- **Guardrails:** sanitize all text (no raw HTML, strip scripts), length limits, allow-list of email variables, https-only URLs, no sensitive question types (block obvious patterns such as card numbers), creators are controllers of buyer data. Stored in `products.checkout`, `products.afterPurchase`, `products.ui`.
- Live preview next to the editor for the card, product page and checkout.

### F12. Customers panel (P0)
- Table: customer (name, email), products bought, total spent, last order, answers count. Search, filter by product, cursor pagination, **Export CSV** (sanitize against CSV formula injection).
- Customer detail drawer: contact info, orders, **checkout answers** (question label snapshot and value), notes, tags.
- Data comes from `customers` (updated atomically when an order is paid) and `orders.answers`. Creators only see their own customers.

### F13. Buyer library (P0)
`/library`: sign in with email code; list of purchases with cover, title, creator, date and a Download (or Open link) button; shows "Download limit reached" state; refunds revoke access. A buyer sees only their own entitlements.

---

## 5. Architecture

### 5.1 Stack
Next.js (App Router) + TypeScript strict + Tailwind + shadcn/ui; Node.js worker; MongoDB Atlas; Redis (rate limits, later cache); S3 (private) + CloudFront; Resend; Zod; Vitest and Playwright; Sentry. Hosting on AWS (path to ECS Fargate in `ARCHITECTURE.md`; Phase 1 deploy picks the simplest reliable option). Money as integer minor units.

### 5.2 Routing (path-based, one domain)
| Route | Purpose |
|---|---|
| `/` | Marketing landing |
| `/login`, `/signup` | Auth (done) |
| `/dashboard` and children | Creator app |
| `/@username` | Public store (rewrite to an internal route) |
| `/@username/[productSlug]` | Product page |
| `/@username/[productSlug]/checkout` | Checkout |
| `/checkout/success` | Post-payment page |
| `/library` | Buyer library |
| `/api/checkout`, `/api/webhooks/stripe-connect`, `/api/files/*`, `/api/library/download/*` | Server endpoints |

Custom domains later map a host to a store. Reserved usernames include `app, www, api, admin, login, signup, dashboard, library, checkout, pricing, terms, privacy, help, support`.

### 5.3 Folder structure
Modular monolith: `apps/web` (Next.js), `apps/worker` (Node), `packages/core` (domain logic, repositories, Zod schemas, product-type registry, payment providers). Business logic lives in `packages/core`, never in route files. (If the repo uses a different layout, keep it and document it.)

### 5.4 Data model (MongoDB)
Full field-level spec: **`docs/DATABASE.md`** (50 collections across phases). Phase 1 collections: `users`, `auth_otps`, `signup_intents`, `sessions`, `stores`, `files`, `products`, `orders` (with embedded `items[]`, `answers[]`, `refunds[]`), `customers`, `entitlements`, `store_stats_daily`, `webhook_events`, `outbox_events`, `email_log`, `audit_logs`.
Rules: every tenant document has `storeId`; money as `...Minor` integers; snapshots on orders; unbounded data in its own collection; TTL on temporary data; every query has an index; additive schema changes with `schemaVersion`. If the existing code differs from `docs/DATABASE.md`, report it and agree on one source of truth.

### 5.5 Tenant isolation and security
1. All data access through repositories in `packages/core`; route handlers, server actions and components never touch models or the driver (enforce with an ESLint rule).
2. Every repository call receives a context (`actorId`, `storeId`, role) and always adds ownership scoping.
3. Server-side guards: `requireUser`, `requireStoreOwner`, `requireEntitlement`.
4. Locked fields are server-written only: `users.isCreator`, `stores.payments.*`, `stores.planTier`, `orders.*`, `entitlements.*`.
5. **NoSQL injection:** strict Zod schemas, reject objects where strings are expected and keys starting with `$` or containing `.`.
6. A **cross-tenant test suite** must stay green: creator A cannot read, update or delete creator B's store, products, orders, customers, entitlements; buyers see only their own purchases; anonymous users see only published public data; locked fields cannot be changed through any request.
7. Secrets in env/Secrets Manager only; never in client bundles or logs. Rate limit auth, checkout, files and download endpoints. Security headers and CSP. Audit log for sensitive actions.

### 5.6 Payments and orders flow
A. **Connect:** OAuth with signed, user-bound `state`; store `accountId`; keep `chargesEnabled`/`payoutsEnabled` fresh from account webhooks; handle deauthorization (unpublish paid products).
B. **Checkout:** see F4. With MockProvider, the checkout page redirects to a fake hosted page that fires the same internal "payment succeeded" event as the Stripe webhook, so the whole pipeline is testable without Stripe.
C. **Webhook (provider events):** verify signature; insert the event id into `webhook_events` (unique `_id`); if it already exists, return 200 and stop; enqueue work; respond quickly.
D. **Worker, in one MongoDB transaction:** mark order `paid`, upsert `customers` (`$inc` totals), upsert `entitlements`, `$inc` `store_stats_daily`, write `outbox_events` (`order.paid`). Subscribers send emails. On refund: mark refunded, set entitlement `revoked`, adjust stats.
E. **Library download:** check entitlement and limit, atomic `downloadCount` increment, return presigned URL.

### 5.7 Video (Phase 2)
Mux direct upload, webhook-driven status, signed playback tokens issued after an entitlement check (details in `docs/DATABASE.md` `lessons`).

### 5.8 API and server rules
Strict Zod on every input; typed `Result` outputs; no internal error leakage; pagination by cursor; idempotent webhooks and jobs.

---

## 6. Non-functional requirements
- **Security:** section 5.5; webhook signatures; presigned URLs; sanitized markup; CSV injection protection; dependency audit.
- **Performance:** public pages cached (CDN plus revalidation), LCP under 2.5 s, API p95 under 300 ms, no collection scans (tests assert indexes on hot queries). Design for 10k concurrent users, deploy for 100; no capacity claims before a load test.
- **Accessibility:** WCAG 2.1 AA, keyboard-operable everything, reduced motion.
- **Privacy:** collect the minimum, consent text stored for marketing contacts, data export and deletion, cookie banner for EU/UK.
- **Reliability:** idempotent webhooks, queue retries, backups, error monitoring.

---

## 7. Design
`DESIGN.md` is the source of truth (white, professional, Stan-like centered layouts, tokens, components, themes). Use only tokens and the shared components. UI reference images, when provided, live in `docs/ui-reference/` named by screen; read one only when building that screen.

---

## 8. Build plan: remaining blocks (one block per session, plan first)

Each block ends with: runs locally, lint, typecheck and tests green, security checklist from `CLAUDE.md`, small commits, short report. Order is fixed.

| Block | Goal | Read from this PRD | Key deliverables | Gate |
|---|---|---|---|---|
| **R0** | Audit | whole file once | Status report vs this PRD and `docs/DATABASE.md` | Founder approves |
| **R1** | Dashboard shell + Store setup | F8, F1 (Google), 5.2 | Sidebar and top bar, checklist, Store setup, Settings skeleton, Google sign-in if missing | Creator completes setup |
| **R2** | Files and S3 | F3b, 5.5 | `files` repository, presigned upload, validation, private bucket, avatar and cover upload | Private objects never public |
| **R3** | Products | F3, F11 | Type registry, picker, digital editor (4 tabs), checkout-fields builder, My Store list, publish rules | Create, edit, publish a product |
| **R4** | Public store and product pages | F2, F4 (product page), 5.2 | `/@username` rewrite, store page, product page, themes, SEO, caching and revalidation, Buy disabled until R5 | Share a working link |
| **R5** | Payments and checkout | F4, 5.6, section 2 | `PaymentProvider`, MockProvider, Stripe adapter, Payments settings, checkout with custom fields, pending orders | Mock purchase reaches paid |
| **R6** | Orders pipeline, Customers, Income | F12, F8, 5.6 | Webhook handler, worker/outbox, transaction, customers, stats, Customers and Income screens, CSV export | Paid order appears in panels |
| **R7** | Buyer library and secure downloads | F13, F3b | `/library`, entitlement checks, presigned downloads, limits, external links, refund revocation | Buyer downloads securely |
| **R8** | Emails | F7 | Resend templates, queue, `email_log`, creator-customizable confirmation, test email | Receipt arrives once per order |
| **R9** | Security review and tests | 5.5, 6 | Cross-tenant tests, injection tests, rate limits, headers, Playwright e2e smoke, basic load test | Review findings fixed |
| **R10** | Deploy to AWS | 6 | Environments, container build, deploy, domain, webhooks registered, monitoring, backups | Go/no-go checklist passes |

**Estimate (solo + Claude Code):** R1 to R4 about 2 days; R5 to R8 about 2 days; R9 to R10 about 1 to 2 days. If a block runs long, cut customization depth, not tests or security.

### 8.1 Smoke test (founder, manual, end of R9)
1. Sign up as Creator A; confirm the draft store and checklist.
2. Complete Store setup; open `pickstall.store/@username` (draft is 404 publicly).
3. Add a digital product with a file, custom button text and two checkout questions; publish.
4. As an anonymous buyer buy it (MockProvider/test mode), answering the questions.
5. Receipt email arrives once; library shows the product; download works; the link expires after about a minute.
6. Creator sees the order, the customer, the answers and income updated.
7. Replay the webhook: still one order and one entitlement.
8. Refund: access revoked.
9. Creator B cannot open Creator A's product, order, customer or file by ID.
10. Check 360 px mobile, keyboard navigation and reduced motion.

### 8.2 Go / no-go
**Private alpha (test/mock mode):** smoke test passes, tests green, deployed with HTTPS, alpha creators told it is a test version.
**Public launch with real money:** payment provider live approval, one real $5 purchase and refund, Terms/Privacy/Refund live, independent review of auth and payment code, monitoring and support channel, CA consulted on export-of-services income.

---

## 9. Roadmap after Phase 1

| Phase | Time (rough) | Features |
|---|---|---|
| **2. Core** | Week 2 | Courses (modules, lessons, Mux video, progress), coupons, order bumps, legal pages, cookie banner |
| **3. Growth** | Weeks 3-5 | Email list and lead magnets, broadcasts and basic automation, abandoned cart, pixels, upsell, custom domain, block-based page editor, import (Gumroad API, Stan CSV) and export, platform billing and plan limits |
| **4. Advanced selling** | Weeks 6-9 | Funnels, memberships, payment plans, bookings, affiliate tracking, quizzes and certificates, reviews, license keys, multi-currency, attribution analytics |
| **5. Moat** | Months 3-4 | Instagram AutoDM, community, A/B tests, AI assistant, API and webhooks, team roles, creator PWA, template library |

Custom domain and import specs: connect via a domain-verification flow (DNS records shown in the UI, status pending, verified, SSL, live) and import with preview, column mapping, idempotent jobs, consent handling (imported contacts are not marketable until re-permission) and encrypted OAuth tokens.

---

## 10. Success metrics
Activation (signup to published store to connected payments to first sale), time to first published product, bugs per active creator, trial-to-paid conversion, qualitative "very disappointed if gone" score.

## 11. Open questions
1. Stripe India invite and test-mode availability (use MockProvider meanwhile).
2. Final AWS region and hosting option for the first deploy (EC2 vs ECS Fargate).
3. Resend sending domain and physical address for email footers.
4. Username change policy after publishing (Phase 1: allowed, old link stops working; revisit).
5. Mongoose vs official driver (use what the code already uses).
6. PayPal application outcome.

## 12. Risks
| Risk | Mitigation |
|---|---|
| Stripe India limits or invite delay | MockProvider, provider interface, PayPal application, plan for a US entity only if demand proves it |
| Tenant data leak without RLS | Repository layer, lint rule, cross-tenant tests on every commit, independent review |
| Scope creep | Fixed block order, "Coming soon" tags, phase gates |
| Customization abuse (XSS, spam, sensitive data) | Sanitization, limits, allow-lists, field guardrails |
| Cost and complexity of AWS | Design for 10k, deploy for 100; staged scaling |
| Low trust in a new platform | Founding offer, personal onboarding, honest copy |
