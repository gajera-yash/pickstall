# PRD: Pickstall

> Status: v1.0 | Owner: Founder (solo, vibe-coding with AI tools) | Last updated: 2026-10-22
> Rename the product by editing `lib/config.ts` (`APP_NAME`, `ROOT_DOMAIN`). Do not hardcode the name anywhere else.

---

## 1. Summary

Pickstall combines **Stan Store** (link-in-bio storefront, courses, order bumps/upsells) and **Gumroad** (digital product selling, pay-what-you-want, license keys, memberships, bundles) in one platform for **online course creators and digital-product sellers**. A creator gets a mobile-first link-in-bio storefront, hosts video courses, sells digital downloads, and takes payment through Stripe checkout with coupons and order bumps. There is **no transaction fee**; the platform earns from a low monthly subscription.

**One-line positioning:** "Stan Store + Gumroad in one platform: storefront, courses, digital products, coupons and bumps for one low monthly price. 0% transaction fee."

**Fee comparison hook (verify current Gumroad fees before using in marketing):** Gumroad charges 10% + $0.50 per direct sale (plus card processing). Example: 40 sales of $50 in a month = $200 + $20 = $220 in Gumroad fees, versus a flat $19-39 subscription here.

### 1.1 Target user (ICP)
- Course creators and coaches located in **tier-1 countries (USA, UK, Canada; Australia later)**.
- 3k-100k followers, already selling or about to sell at least one course.
- Currently pays for 2+ tools (link-in-bio store + course platform) or finds Stan's $99 plan expensive.
- Secondary: digital-product sellers (ebooks, templates, presets, software) who want out of Gumroad's per-sale fee.

### 1.2 Problem
- Creators stitch together a store, a course host, email and discount tooling, and pay for each separately.
- Stan locks upsells, funnels, email and affiliates behind its highest plan, and has no custom domain support.

### 1.3 Goals (first 90 days after beta starts)
| Goal | Target |
|---|---|
| Founding creators onboarded | 10-15 |
| Creators who publish a store | 70% of onboarded |
| Creators with at least one real sale | 40% of onboarded |
| Paying creators after trial | 5+ |
| Critical bugs open > 48h | 0 |

### 1.4 Non-goals (MVP)
- No physical products, no marketplace/discovery feed, no mobile app, no community/forum, no live classes, no affiliate payouts, no WhatsApp automation, no multi-language UI.

---

## 2. HARD CONSTRAINTS (read before designing anything)

These come from Stripe's reply to the founder's inquiry (founder is India-based). Re-verify with Stripe before launch; they drive the whole payments design.

1. The platform Stripe account is **India-based and invite-only**. Live mode requires an invite granted via Stripe's sales contact form.
2. Creators connect their own **Standard** connected accounts (OAuth). Customers' money goes **directly to the creator** via **direct charges**.
3. **NO application fee** on direct charges (not supported for India platform + non-India connected account).
4. **Do NOT use**: destination charges, separate charges and transfers, standalone transfers, manual payouts to connected accounts, or cross-border payouts. They are unsupported for India platforms.
5. Platform subscription revenue is collected via **Stripe Billing on the platform account** in USD/GBP/CAD ("export" charges). Payouts to the founder settle in **INR** only.
6. Consequences:
   - Pricing model is **subscription only**. No "free plan with a % fee". Use a **14-day free trial**.
   - **Affiliate payouts cannot be automated.** Affiliates are post-MVP and track-only.
   - Creators (connected accounts) are responsible for their own KYC, taxes and negative balances.
7. If the founder later creates a US entity (Stripe Atlas), these restrictions may lift. Isolate payment logic behind `lib/payments/` so the model can change without rewriting features.
8. **We are NOT a Merchant of Record (unlike Gumroad, which has been MoR since Jan 2025 and handles global sales tax and chargeback liability).** Creators are the seller of record for their own sales and handle their own tax (VAT/GST/sales tax) and disputes through their Standard Stripe accounts. Never promise tax handling in the product or marketing. Show a clear notice in the dashboard (Connect payments step) and Terms. A third-party MoR option is a P2 consideration.
9. Student memberships/subscriptions as direct charges on a creator's connected account are **unverified** for an India-based platform. Confirm with Stripe before building them (P1).
10. **Payments must be provider-agnostic.** All payment code sits behind a `PaymentProvider` interface (`createCheckout`, `handleWebhook`, `refund`). Build the **Stripe adapter first**. A **PayPal adapter** (PayPal Commerce Platform / multiparty, requires PayPal approval) is a backup only if Stripe's India invite is delayed. Never leak provider-specific types outside `lib/payments/`.

---

## 3. Personas and user stories

### 3.1 Creator (primary)
- As a creator, I sign up and get my store live in under 15 minutes.
- As a creator, I connect my Stripe account so sales go straight to me.
- As a creator, I upload video lessons, organize them in modules, and set a price.
- As a creator, I create discount codes and an order bump to raise average order value.
- As a creator, I see my sales, revenue and student list in one dashboard.
- As a creator, I get an email when I make a sale.

### 3.2 Buyer / student
- As a buyer, I open a creator's store on my phone and buy a course in under a minute (Apple Pay / Google Pay / card).
- As a buyer, I receive an email with a link to my course immediately after paying.
- As a buyer, I sign in with an email code (no password) and see my library.
- As a buyer, I watch lessons, resume where I left, and mark lessons complete.

### 3.3 Platform owner (founder)
- As the owner, I see all creators, plans, trial status and basic usage in an admin page.

---

## 4. MVP feature scope

Priority: **P0** = must ship in MVP, **P1** = fast follow (weeks 7-10), **P2** = later.

### F1. Auth and signup (P0)
- Creator signup is **2 steps**: details (username, full name, email, optional phone), then a 6-digit email code, then straight to `/dashboard`. The username is the store slug (unique, `^[a-z0-9-]{3,30}$`). No store setup, activation page or billing steps in signup (D-008).
- A **draft (unpublished) store is created automatically** at signup, using the username as slug. The link is reserved and the user becomes a creator. The signup details wait server-side in `signup_intents` (30 minutes, bound to the browser that started signup) and the store is created with the user's own session right after the code is verified; client-editable auth metadata is never trusted (D-019). If the username was taken in the meantime, the session is kept and the user chooses another username (D-020).
- Google sign-in is supported. New Google users get one extra step to choose a username (and an optional phone number).
- Store setup (name, avatar, bio, currency, theme, accent, link) is a **first-run checklist in the dashboard**: Store setup, Add first product, Connect payments, Publish (D-009, F8).
- Buyer auth: email OTP only. Buyers **never use signup**; they sign in with an email code at checkout or on the library page, and the account is created automatically after purchase.
- **Acceptance:** a new creator reaches the dashboard with a reserved link in under 2 minutes and a published (empty) store page in under 5; usernames are validated server-side; reserved slugs (`app`, `www`, `api`, `admin`, `login`, `s`, etc.) are rejected; the sign-in response is the same whether or not the email has an account.

### F2. Storefront (P0)
- Public page at `{ROOT_DOMAIN}/@username` (production domain `pickstall.store`); product pages at `/@username/product-slug`. Path-based on one domain, no subdomains (D-010). `/@username` is a `next.config` rewrite to `/s/:username`. Custom domains (Phase 3) map a host to a store.
- Sections: avatar + name + bio, social links, product cards (cover, title, price, CTA), optional email-capture block (P1).
- 3 theme presets (Clean, Bold, Soft) with an accent color that is checked for contrast (`DESIGN.md` section 11). The creator also sets name, photo, bio and links (D-013). Mobile-first, passes Lighthouse performance and accessibility >= 90.
- SEO: title, description, Open Graph image, canonical URL, sitemap.
- **Acceptance:** store renders server-side, loads under 2.5s LCP on 4G, and works at 360px width.

### F3. Course hosting (P0)
- Course = ordered modules, each with ordered lessons.
- Lesson types: video (Mux direct upload), text/markdown, downloadable attachment (P1).
- Draft/published state per course and per lesson; free preview lessons; drip by days (P1).
- Student player: resume position, mark complete, next lesson, progress bar.
- Videos are never served from public URLs: **signed playback tokens**, created server-side after an enrollment check.
- **Acceptance:** a non-enrolled user cannot obtain a playable URL for a paid lesson (verified by test); video upload shows progress and processing state.

### F3b. Digital products (Gumroad parity, P0)
- Products are created through a **type picker** (D-012). Live in Phase 1: **Digital product**. Shown as "Coming soon" and not selectable: Course, Coaching call, Membership, Collect emails, Link.
- Product type `digital`: the creator uploads one or more files (PDF, ZIP, audio, templates) to a **private** Supabase Storage bucket, or provides an external link. Default max 500 MB per file (config value). An external link is delivered like a file: only after the verified payment, in the Library and the receipt email.
- Delivery: after the verified payment webhook creates the enrollment, files appear in the buyer's Library. Downloads use **short-lived signed URLs (about 60 seconds)** generated server-side after an enrollment check. Optional per-product download limit.
- Pricing models: **fixed** or **pay-what-you-want** (creator sets a minimum; buyer enters an amount on our product page; server validates `amount >= min_price_cents` and a sane maximum, then passes the amount as inline `price_data`).
- Digital products can be sold standalone or used as order-bump items.
- **Customization** (D-013): title, description, cover, fixed or pay-what-you-want price, button text, checkout headline, thank-you message, confirmation email subject and body (variables `{{customer_name}}`, `{{product_title}}`, `{{download_link}}`), download limit. Stored in `products.settings` (planned, see 5.4.1). Guardrails: all creator text is sanitized and length-limited (no raw HTML); the sender identity and the download link are always in the email; after-purchase redirect URLs must be `https` (D-014).
- **Acceptance:** a non-buyer cannot obtain a file URL; a pay-what-you-want amount below the minimum is rejected server-side; a refund revokes access; files are never reachable through a public bucket path.

### F4. Product page and checkout (P0)
- Product page: cover, title, description, curriculum outline (courses, Phase 2), price, buy button. The creator can change the button text, the checkout headline and the thank-you message (F3b).
- Checkout via **Stripe Checkout Session, direct charge on the creator's connected account** (`stripeAccount` header), **no application fee**.
- Prices are computed **on the server** from DB values. Never trust client prices.
- Uses Stripe Checkout **dynamic payment methods** (card, Apple Pay, Google Pay and more where available), so creators in other countries can offer more methods. The exact availability is verified in the Stripe docs during the payments block (D-016). Currency per store.
- **Checkout fields** (D-013): name and email are always required; an optional phone toggle; up to 5 custom questions per product (text, long text, dropdown, checkbox, each with a required flag). No sensitive questions (card or ID numbers). Answers are validated server-side, stored per order (`orders.answers`, planned) and shown in the Customers panel (F8) with CSV export.
- After payment: order marked paid, enrollment created, buyer emailed (F7), creator notified.
- Refunds: creator refunds in their own Stripe dashboard; webhook `charge.refunded` revokes enrollment (configurable, default revoke).
- **Acceptance:** duplicate webhook deliveries never create duplicate orders or enrollments; a creator without a connected Stripe account cannot publish a paid product; required questions are enforced on the server and answers can never change the price.

### F5. Coupons (P0)
- Creator creates codes: percent or fixed, optional expiry, max redemptions, product restriction.
- Applied at checkout; discount calculated server-side; redemption counted atomically on payment success.
- **Acceptance:** expired, exhausted, or wrong-product codes show a clear error; a code cannot be redeemed beyond its limit under concurrent checkouts.

### F6. Order bump (Phase 2, available on Starter and up)
- A creator attaches one bump product to a product: headline, price, checkbox on the checkout step.
- Implemented as an extra line item on the same Checkout Session.
- **Acceptance:** bump shows only when configured; the order records the bump as a separate `order_items` row with `is_bump = true`.

### F7. Transactional email (P0)
Provider: Resend. Templates built with React Email.
- Creator welcome.
- Buyer purchase receipt / confirmation with "Access your purchase" link (course or downloads). The creator can customize the subject and body per product with the variables `{{customer_name}}`, `{{product_title}}` and `{{download_link}}`. The sender identity, the footer and the download link are always included, and the text is sanitized (no raw HTML) (D-014).
- Creator "You made a sale" notification.
- Buyer sign-in code (handled by Supabase Auth email, branded).
- Every email has the sender identity, physical-address footer (CAN-SPAM) and, for marketing email, an unsubscribe link (P1).
- **Acceptance:** emails are sent from a queue/job (not inline in the webhook), with retry on failure and a row in `email_log`.

### F8. Creator dashboard (P0)
Four sections (D-011): **My Store**, **Income**, **Customers**, **Settings**. A first-run checklist (D-009) shows until done: Store setup, Add first product, Connect payments, Publish.
- **My Store:** store setup (name, avatar, bio, currency, theme, accent, link) and products: type picker, list, create, edit, publish/unpublish, reorder, with the customization options of F3b.
- **Income:** revenue (today / 7d / 30d), orders count, top products, recent orders with status, amount and refund state.
- **Customers:** buyers with email, name, optional phone, purchase date and their answers to the checkout questions (F4); CSV export (formulas neutralized, D-014).
- **Settings:** account, Stripe connection status. Billing arrives in Phase 3; coupons and student progress (courses) arrive in Phase 2.
- **Acceptance:** all dashboard queries are scoped by `store_id` and protected by RLS.

### F9. Platform billing (Phase 3, must be live before the 6-month founding free period ends)
- Founding creators (10 spots) get 6 months free, so billing is **not needed for Phase 1 or 2**. Build it in Phase 3. Provider is decided then: Stripe Billing (if the India invite is granted) or a Merchant of Record such as Dodo Payments (India-based, UPI). After the founding period, new creators get a 14-day free trial.
- Customer Portal for upgrade, downgrade, cancel, invoices.
- Feature gating through one central `PLAN_LIMITS` config and a `can(plan, feature)` helper.
- Past-due grace period of 7 days, then stores are unpublished (data kept, never deleted).

| Plan | Price (placeholder, validate) | Includes |
|---|---|---|
| Founding (10 spots) | Free for 6 months | Pro features, personal setup |
| Starter | $19/mo | Unlimited digital products, up to 5 courses, 20 hours of video, 1,000 email subscribers, pay-what-you-want, coupons, order bumps, lead magnets, pixel tracking, purchase emails, 0% fee |
| Pro | $39/mo | Unlimited courses, 100 hours of video, 10,000 subscribers, upsells, funnels, payment plans, memberships, bookings, affiliate tracking, custom domain, remove branding, quizzes and certificates, automation flows |
| Business | $79/mo | 300 hours of video, 50,000 subscribers, A/B tests, advanced attribution, API, team seats, priority support, import help |

Video hours and subscriber limits are placeholders until Mux and Resend costs are checked. Feature availability follows the phases in section 12; features not yet built are labelled "Coming soon" in the product and on the landing page.

Limits and prices are config values, not hardcoded.

### F10. Legal and compliance basics (P0)
- Platform Terms of Service, Privacy Policy, Refund policy template, cookie banner (GDPR / UK GDPR / CCPA).
- Each store footer links to platform terms and shows the creator's name. Creators set their own refund policy text.
- Data export and account deletion request flow (GDPR).
- Creators are responsible for their own sales tax/VAT/GST (Standard accounts). State this in Terms and in the dashboard's Connect payments step.

### P1 backlog (weeks 7-10)
1. Custom domains (Vercel Domains API, auto SSL, CNAME instructions).
2. Abandoned-cart email (1h and 24h).
3. Post-purchase upsell.
4. Email capture block + simple broadcast to subscribers (with unsubscribe).
5. Drip content, downloadable attachments, quizzes, completion certificates.
6. Analytics: traffic source, UTM, funnel; Meta/TikTok pixel field.
7. AI helper (Claude API): product description, course outline, email copy.
8. "Powered by" badge removal on Pro.
9. License keys for software products (auto-generated per purchase, verification endpoint).
10. Product bundles (several products sold as one).
11. Student memberships/subscriptions with tiers (only after Stripe confirms direct-charge subscriptions work for an India platform; see Constraint 9).
12. Free ($0) products with email capture, PDF stamping with buyer email, buyer email workflows (post-purchase sequences).

### P2 backlog
Payment plans/installments, 1:1 booking, pre-orders, a Discover-style marketplace (needs real traffic first), a merchant-of-record option through a third-party provider, affiliate tracking (no automated payouts unless a US entity exists), community, template marketplace, Australia/EU expansion, mobile app (Flutter).

### Gumroad parity map
| Gumroad capability | Here | Priority |
|---|---|---|
| Digital downloads | F3b | P0 |
| Pay-what-you-want | F3b | P0 |
| Discount codes | F5 | P0 |
| Upsells / order bump | F6 + P1 upsells | P0 / P1 |
| Custom domain | P1 backlog | P1 |
| Product bundles | P1 backlog | P1 |
| License keys | P1 backlog | P1 |
| Memberships / tiers | P1 backlog, pending Stripe confirmation | P1 |
| Email workflows to buyers | P1 backlog | P1 |
| PDF stamping | P1 backlog | P1 |
| Affiliates | Track-only, no automated payouts (Constraint 6) | P2 |
| Pre-orders | P2 backlog | P2 |
| Discover marketplace | Needs traffic first | P2 |
| Merchant of Record tax handling | **Not possible now** (Constraint 8) | Not planned |

---

## 5. Architecture

### 5.1 Stack (locked)
| Layer | Choice |
|---|---|
| App | Next.js (latest stable, App Router), TypeScript strict |
| UI | Tailwind CSS + shadcn/ui, lucide-react icons |
| DB / Auth / Storage | Supabase (Postgres, Auth, Storage, RLS) |
| ORM / types | Supabase generated types (or Drizzle if preferred); migrations as SQL files |
| Payments | Stripe (Connect Standard + Checkout direct charges; Billing for platform plans) |
| Video | Mux (direct uploads, signed playback) |
| Email | Resend + React Email |
| Jobs | Inngest (webhook follow-up work, emails, retries) |
| Hosting | Vercel |
| Analytics | PostHog |
| Errors | Sentry |
| Validation | Zod on every API/server action input |
| Tests | Vitest (unit), Playwright (e2e happy path) |

### 5.2 Routing (path-based, one domain)
- One domain (`ROOT_DOMAIN`; production `pickstall.store`) and **no subdomains** (D-010):
  - `/`: marketing site. `/login`, `/signup`: auth. `/dashboard`: creator app. `/library`: buyer library.
  - `/@username` and `/@username/product-slug`: public store and product pages. Implemented with `next.config` **rewrites** to `/s/:username` and `/s/:username/:path*`, because an `app/@...` folder would be a Next.js parallel route and cannot be used.
  - Unknown host: look up `stores.custom_domain` and serve that store at `/` (Phase 3, section 13).
- Every store-scoped query includes `store_id`. Never infer the store from client input alone.

### 5.3 Folder structure
```
/app
  /(marketing)            landing, pricing, legal
  /(dashboard)/dashboard  creator area
  /(store)/s/[slug]       public store + product + checkout return pages (served at /@username by a rewrite)
  /(student)/library      student library + lesson player
  /api/webhooks/stripe-platform/route.ts
  /api/webhooks/stripe-connect/route.ts
  /api/webhooks/mux/route.ts
/components               ui (shadcn) + feature components
/lib
  config.ts               APP_NAME, ROOT_DOMAIN, PLAN_LIMITS, RESERVED_SLUGS
  /payments               stripe client, checkout, connect, billing helpers
  /supabase               server/client/admin clients
  /email                  resend client + react-email templates
  /video                  mux helpers (upload url, signed token)
  /auth                   guards: requireCreator, requireStoreOwner, requireEnrollment
/supabase/migrations      SQL migrations (source of truth for schema)
/tests
```

### 5.4 Data model (Postgres)
```sql
create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'buyer' check (role in ('creator','buyer')),
  created_at timestamptz not null default now()
);

create table stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,30}$'),
  custom_domain text unique,
  name text not null,
  bio text,
  avatar_url text,
  theme jsonb not null default '{"preset":"clean","accent":"#111827"}',
  social_links jsonb not null default '[]',
  currency text not null default 'usd' check (currency in ('usd','gbp','cad')),
  stripe_account_id text unique,
  stripe_charges_enabled boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  type text not null default 'course' check (type in ('course','digital')),
  title text not null,
  slug text not null,
  description text,
  cover_url text,
  price_cents integer not null check (price_cents >= 0),
  compare_at_price_cents integer check (compare_at_price_cents >= 0),
  pricing_model text not null default 'fixed' check (pricing_model in ('fixed','pwyw')),
  min_price_cents integer check (min_price_cents >= 0),   -- used when pricing_model = 'pwyw'
  download_limit integer check (download_limit > 0),      -- optional, digital products
  status text not null default 'draft' check (status in ('draft','published','archived')),
  bump_product_id uuid references products(id) on delete set null,
  bump_price_cents integer check (bump_price_cents >= 0),
  bump_headline text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, slug)
);

create table product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  storage_path text not null,        -- private bucket path, never exposed publicly
  file_name text not null,
  size_bytes bigint not null,
  mime_type text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table modules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  title text not null,
  position integer not null default 0
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  kind text not null default 'video' check (kind in ('video','text')),
  mux_asset_id text,
  mux_playback_id text,
  mux_status text check (mux_status in ('uploading','processing','ready','errored')),
  duration_seconds integer,
  content_md text,
  is_free_preview boolean not null default false,
  is_published boolean not null default false,
  drip_days integer not null default 0
);

create table coupons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  code text not null,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value integer not null check (discount_value > 0),
  max_redemptions integer,
  redeemed_count integer not null default 0,
  expires_at timestamptz,
  product_ids uuid[],
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index coupons_store_code_idx on coupons (store_id, upper(code));

create table orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  buyer_user_id uuid references profiles(id) on delete set null,
  buyer_email text not null,
  status text not null default 'pending' check (status in ('pending','paid','refunded','failed')),
  subtotal_cents integer not null,
  discount_cents integer not null default 0,
  total_cents integer not null,
  currency text not null,
  coupon_id uuid references coupons(id) on delete set null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  unit_price_cents integer not null,
  is_bump boolean not null default false
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table lesson_progress (
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  position_seconds integer not null default 0,
  completed_at timestamptz,
  primary key (user_id, lesson_id)
);

create table platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references profiles(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'trial' check (plan in ('trial','starter','pro','business')),
  status text not null default 'trialing',
  trial_end timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table webhook_events (
  id text primary key,              -- Stripe/Mux event id (idempotency key)
  source text not null,             -- 'stripe-platform' | 'stripe-connect' | 'mux'
  type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table email_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete set null,
  to_email text not null,
  template text not null,
  status text not null default 'queued',
  provider_id text,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade,
  type text not null,               -- 'store_view','product_view','checkout_start','purchase'
  path text,
  utm jsonb,
  session_id text,
  created_at timestamptz not null default now()
);
```

#### 5.4.1 Planned additions (not migrated yet, ask the founder first)
Needed for creator customization (D-013, D-015). Each gets RLS and tests: a creator can only see their own rows.
- `products.settings jsonb`: button text, checkout headline, thank-you message, confirmation email subject and body, redirect URL, and so on. Public views expose only a whitelist of keys (the email text and redirect URL are not public).
- `product_checkout_fields` table: up to 5 custom questions per product (label, type text / long text / dropdown / checkbox, options, required flag, position).
- `orders.answers jsonb`: the buyer's answers, stored per order.
- `customers` table: `store_id`, `email`, `name`, `phone`.
- Decided (D-021, migration batch 1): `products.external_url` (nullable, https only, never in public views). A digital product can only be published with at least one file or an external URL.
- Decided (D-019, migration batch 1): `signup_intents` (service role only) keeps signup details for 30 minutes until the email code is verified.

The live schema already differs from the listing above in a few places; those changes are recorded in `docs/DECISIONS.md` (D-003, D-004) and in the `profiles.phone` migration (optional phone, set only by the signup trigger).

### 5.5 Row Level Security (rules, write as migrations)
- RLS **enabled on every table**. No table without policies.
- `profiles`: user reads/updates own row only.
- `stores`, `products`, `modules`, `coupons`, `orders`, `order_items`, `events`: creator can CRUD rows whose `store_id` belongs to a store they own (use a `owns_store(store_id)` SQL helper).
- Public read: `stores` where `is_published`, `products` where `status = 'published'` through narrow policies or views exposing only public columns. Never expose `stripe_account_id` publicly.
- `lessons` content and Mux playback ids: **not publicly readable**. Access goes through a server route that calls `requireEnrollment` (or free-preview check) and then issues a signed Mux token.
- `enrollments`, `lesson_progress`: user reads own rows; creator reads enrollments of their products.
- `webhook_events`, `email_log`, `platform_subscriptions` writes: **service role only**; creators read their own subscription.
- The service-role client is used only in server code (`lib/supabase/admin.ts`), never imported into client components.

### 5.6 Payment flows

**A. Creator connects Stripe (Standard, OAuth)**
1. Dashboard "Connect Stripe" starts the OAuth flow with a signed `state` (CSRF-safe, bound to the user).
2. Callback exchanges the code, stores `stripe_account_id` on the store.
3. Webhook `account.updated` (Connect endpoint) refreshes `stripe_charges_enabled`.
4. `account.application.deauthorized` clears the account and unpublishes paid products.

**B. Buyer checkout (direct charge, no application fee)**
1. `POST /api/checkout` validates input (Zod): `productId`, optional `couponCode`, `bump` boolean, `email`.
2. Server loads product, store, coupon from DB, and recomputes amounts.
3. `stripe.checkout.sessions.create({ mode: 'payment', line_items, currency, customer_email, metadata: { order_id, store_id }, success_url, cancel_url }, { stripeAccount: store.stripe_account_id })`. **Do not pass `application_fee_amount`.**
4. Insert `orders` row as `pending` with the session id.
5. Return the session URL; redirect the buyer.

**C. Fulfillment via Connect webhook**
1. Verify the signature with the Connect webhook secret. Reject on failure.
2. Insert the event id into `webhook_events`; if it already exists, return 200 and stop (idempotent).
3. On `checkout.session.completed`: mark order `paid`, create or find buyer profile by email, create `enrollments`, increment coupon `redeemed_count` atomically, enqueue emails (Inngest).
4. On `charge.refunded`: mark order `refunded`, set `enrollments.revoked_at`.
5. Always respond quickly with 200; do heavy work in background jobs.

**D. Platform billing (Stripe Billing, platform account)**
1. Create Products/Prices for each plan and currency (USD, GBP, CAD) with `trial_period_days = 14`.
2. Dashboard "Choose plan" creates a Checkout Session in `subscription` mode on the platform account.
3. Platform webhook handles `customer.subscription.created|updated|deleted`, `invoice.payment_failed`, `invoice.paid`; updates `platform_subscriptions`.
4. Billing page links to the Stripe Customer Portal.

### 5.7 Video flow (Mux)
1. Creator selects a file; server creates a Mux **direct upload** URL (policy: signed playback).
2. Browser uploads directly to Mux. Lesson row gets `mux_status = 'uploading'`.
3. Mux webhook `video.asset.ready` stores `mux_asset_id`, `mux_playback_id`, duration; status `ready`.
4. Player requests `/api/lessons/[id]/playback`; server verifies enrollment/free preview, drip rule and non-revoked status, then returns a short-lived signed token.

### 5.8 Routes
| Route | Purpose |
|---|---|
| `/` , `/pricing`, `/terms`, `/privacy` | Marketing + legal |
| `/login`, `/signup` | Auth: 2-step signup, Google, email-code login (no `/onboarding` page, D-008) |
| `/dashboard` | My Store: first-run checklist, store setup, products |
| `/dashboard/products`, `/dashboard/products/[id]` | Product + course builder |
| `/dashboard/income`, `/dashboard/customers` | Income; Customers (answers, CSV export). Student progress arrives in Phase 2 |
| `/dashboard/coupons` | Coupons |
| `/dashboard/settings`, `/dashboard/billing`, `/dashboard/stripe` | Store, billing, Stripe connection |
| `/@username` (rewrite to `/s/[slug]`) | Public store |
| `/@username/[productSlug]` | Product page |
| `/@username/checkout/success` | Post-payment page |
| `/library`, `/library/[productId]`, `/library/[productId]/[lessonId]` | Student area |
| `/api/webhooks/*` | Stripe platform, Stripe Connect, Mux |

---

## 6. Non-functional requirements

**Security (must)**
- Webhook signatures verified for Stripe (two separate secrets) and Mux.
- All secrets in environment variables; never in the repo or client bundle.
- Zod validation on every input; server-side authorization on every mutation (ownership checks, not just UI hiding).
- Rate limit: login/OTP, checkout creation, coupon validation, playback token endpoint.
- File and video access only via signed, expiring URLs/tokens.
- No raw SQL string building; parameterized queries only.
- Security headers (CSP, `SameSite`/`HttpOnly`/`Secure` cookies, `X-Frame-Options` except where embedding is intended).
- Audit log for sensitive actions (Stripe connect/disconnect, plan change, refund-driven revokes).

**Performance:** storefront server-rendered and cached (ISR with on-demand revalidation when a creator edits). Images via `next/image`. Target LCP < 2.5s.

**Accessibility:** WCAG 2.1 AA for storefront and checkout flow; keyboard-operable player controls.

**Privacy and legal:** GDPR/UK GDPR/CCPA consent and deletion; CAN-SPAM/CASL for any marketing email (consent + unsubscribe + physical address); cookie banner for EU/UK visitors; log only what is needed.

**Reliability:** idempotent webhooks; jobs retry with backoff; Sentry alerts on webhook failures; daily DB backups (Supabase).

**Observability:** PostHog events: `signup`, `store_published`, `product_published`, `stripe_connected`, `checkout_started`, `purchase_completed`, `lesson_completed`.

---

## 7. Design direction

> Full design system lives in `DESIGN.md` (tokens, typography, components, themes, motion, accessibility). The summary below is only a pointer; `DESIGN.md` wins on any conflict.

The founder is a UI/UX designer; design quality is the competitive edge.
- Clean, modern, generous whitespace, strong typography (one display + one text font), soft shadows, 12-16px radii.
- Storefront must feel premium on a 360px phone; large tap targets; sticky buy button on product pages.
- Dashboard: simple left nav, empty states with one clear next action, first-run checklist ("Store setup", "Add first product", "Connect payments", "Publish").
- Each theme preset is a token set (colors, radius, font pairing) so new themes are data, not code.
- Dark mode for dashboard (P1).

---

## 8. Build plan (milestones, one at a time)

Each milestone ends with: app runs, tests pass, security checklist from `CLAUDE.md` applied, git commit.

| # | Milestone | Deliverable and Definition of Done |
|---|---|---|
| M0 | Setup | Repo, Next.js + TS + Tailwind + shadcn, Supabase project, env template, CI (lint, typecheck, test), Sentry, PostHog stub |
| M1 | Auth + schema | Migrations for all tables, RLS policies + tests, creator/buyer auth (OTP + Google), profile creation trigger |
| M2 | Signup + store setup | 2-step signup + Google, slug validation, dashboard shell with first-run checklist, public store page at `/@username` (rewrite), 3 themes |
| M3 | Products + course builder | Product type picker, product CRUD (course and digital), customization (D-013), modules/lessons, digital file upload + signed downloads, pay-what-you-want, reorder, draft/publish, product page |
| M4 | Video | Mux direct upload, webhook, signed playback endpoint, student player with progress |
| M5 | Stripe Connect | OAuth connect, account status webhook, publish guard for paid products |
| M6 | Checkout + fulfillment | Checkout Session (direct charge, no fee), creator checkout fields, Connect webhook, orders, enrollments, Customers panel, idempotency tests |
| M7 | Coupons + bump | Coupon CRUD and checkout application, order bump, concurrency test on redemption |
| M8 | Email | Resend templates, Inngest jobs, `email_log`, receipt + creator notification |
| M9 | Platform billing | Plans, trial, Checkout subscription, portal, webhook, `PLAN_LIMITS` gating |
| M10 | Hardening | Security review pass, rate limits, legal pages, cookie banner, data export/delete, e2e happy path, admin page |
| M11 | Beta | 5 founding creators, personal onboarding, feedback loop |

### 8.1 Phase mapping (supersedes the order above where they differ)
- **Phase 1 (3-day private alpha, test mode, D-017):** M0, M1, M2 (signup, dashboard store setup, public store page), M3 (digital products only, with customization), M5, M6 (checkout with creator fields, Customers panel), M8 (lite), M10 (partial). Day 1 = signup, Google, dashboard store setup, My Store with digital product customization, public store page, product page (Buy disabled). Day 2 = Stripe Connect (or MockProvider), checkout, webhook, orders, Customers panel, buyer library, downloads, emails. Day 3 = security review, more payment methods, deploy, smoke test. See `PHASE1_PLAN.md`.
- **Phase 2 (days 4-8):** M4 (courses + Mux), M7 (coupons + order bumps), legal pages.
- **Phase 3 (weeks 2-4):** M9 (platform billing) plus the growth tools in section 12.
- **Phases 4-5:** see section 12.

**Pre-launch checklist**
- [ ] Stripe India invite granted; live keys configured; Connect webhook endpoint registered
- [ ] Real $5 test purchase on a real connected account, then refund
- [ ] RLS test: creator A cannot read or modify creator B's data
- [ ] Non-enrolled user cannot obtain playback token
- [ ] Duplicate webhook replay is harmless
- [ ] Legal pages reviewed by a professional
- [ ] CA consulted on export-of-services income and INR payouts

---

## 9. Success metrics
- Activation: signup -> published store (target 70%), -> Stripe connected (60%), -> first sale (40%).
- Time to first published course: median < 1 day.
- Support load: bugs reported per active creator per week.
- Retention: trial -> paid conversion (target 30%); monthly churn < 8%.
- Qualitative: "How would you feel if this tool disappeared tomorrow?" (target: >= 40% "very disappointed").

---

## 10. Open questions (decide before or during build)
1. **Product name and domain.** Domain decided: `pickstall.store`, path-based (D-010). Still open: the email sending domain and sender setup.
2. **Card required at trial start?** Higher conversion quality vs lower signups. Default: yes, card required.
3. **Does Stripe provide test-mode keys before the India invite is granted?** Confirm with Stripe. If not, use a temporary test account from a supported country for local development only.
4. **Video cost model.** Mux charges by storage and delivery; confirm limits (hours per plan) against real Mux pricing before finalizing plan limits.
5. **Refund policy defaults** and whether revoking access on refund is automatic (default: yes).
6. **Company entity** for the platform (existing company vs new) and a US entity later if application fees/affiliate payouts become necessary.
7. **Support channel** for founding creators (WhatsApp vs email vs Discord).

---

## 11. Risks
| Risk | Mitigation |
|---|---|
| Stripe India restrictions block planned features | Subscription-only model, direct charges, isolate payments code, plan US entity if demand proves it |
| Vibe-coded security gaps (RLS, webhooks, IDOR) | Mandatory security checklist in `CLAUDE.md`, review pass at M10, professional review of auth and payments before launch |
| Video costs outgrow plan prices | Hour limits per plan, usage monitoring, per-plan overage rules |
| Scope creep (clone everything) | Milestone order above; P1/P2 items only after founding-creator feedback |
| Low creator trust in a new tool | Founding-member offer, personal onboarding, fast bug fixes, visible roadmap |
| Email deliverability | SPF/DKIM/DMARC on sending domain from day one, transactional-only at launch |

---

## 12. Full feature roadmap (Stan parity + advanced)

Goal: every Stan Store feature (including its $99 Pro tier) on our lower plans, plus extras, so creators have no reason to look elsewhere. Ship in phases and only advertise what is live.

| Phase | Time (rough) | Features | Gate |
|---|---|---|---|
| 3. Growth tools | Weeks 2-4 | Email list builder, lead magnets, email broadcasts + basic automation, abandoned cart, pixel tracking (Meta/TikTok/Google), one-click upsell, custom domain, block-based store editor, import tools (Stan/Gumroad/Linktree), platform billing + plan limits, cookie banner/GDPR tools | Billing live before founding free period ends |
| 4. Advanced selling | Weeks 5-8 | Funnels + templates, memberships/subscriptions, payment plans, bookings (Google Calendar), affiliate tracking (manual payout), quizzes + certificates, student reviews, bundles, license keys, multi-currency, advanced analytics + attribution | Provider confirms subscriptions/installments work for an India platform |
| 5. Moat features | Months 3-4 | AutoDM (Instagram), community, A/B tests, AI assistant (Claude API), API/webhooks/Zapier, team roles, creator PWA, template library | Meta approval for AutoDM |

### Stan parity checklist
| Stan feature | Stan plan | Ours (plan) | Phase |
|---|---|---|---|
| Mobile store, unlimited courses, 1-tap checkout, analytics | Creator | Starter | 1-2 |
| Lead magnets, email list builder | Creator | Starter | 3 |
| Subscriptions (memberships), bookings, community, AutoDM | Creator | Pro (Business for AI/API extras) | 4-5 |
| Discount codes, order bumps | Pro | Starter | 2 |
| Email marketing, pixel tracking | Pro | Starter | 3 |
| Payment plans, funnels, affiliate payments | Pro | Pro | 4 |

### Constraints that shape the roadmap
- Affiliate payouts cannot be automated on an India platform. Ship tracking and a dashboard; payouts are manual.
- Memberships and payment plans as direct charges are unverified for an India platform; confirm before building.
- AutoDM needs Instagram/Meta API access and app review.
- We are not a Merchant of Record; creators are the seller of record for tax.

### Additional open questions
8. Will PayPal approve the platform application, and on what terms? Submit the platforms/multiparty form alongside the Stripe invite request.
9. Which provider handles our own subscription billing in Phase 3 (Stripe Billing vs a Merchant of Record)?
10. Resolved (D-020): if the username was taken between signup and code verification, the verified session is kept and the user chooses another username. The unique constraint on `stores.slug` decides.

---

## 13. Custom domains (Phase 3, Pro plan)

**Goal:** a creator connects `shop.theirbrand.com` and the store, product pages and checkout run on it with automatic HTTPS.

**Flow**
1. Creator enters a domain in Settings > Domain. Recommend a **subdomain** (`shop.` or `learn.`). Apex domains need an A/ALIAS record and are supported but flagged as harder.
2. Server calls the **Vercel Domains API** to add the domain to the project and reads the required DNS records and verification status. Show those exact records in the UI (CNAME or A, plus a TXT when verification is needed), with short guides for common registrars (GoDaddy, Namecheap, Cloudflare, Google/Squarespace).
3. Poll status with a "Check again" button: `pending DNS` > `verified` > `SSL issued` > `live`. Do not mark the store live on the custom domain before verification.
4. `stores.custom_domain` (unique) plus `custom_domain_status`. Middleware resolves `Host` to the store. Redirect `www` <> apex and the old `/@username` URL to the custom domain; set canonical URLs. On a custom domain the store is served at `/` (D-010).
5. On downgrade or removal, remove the domain from Vercel and fall back to `/@username`.

**Rules and edge cases**
- Cloudflare proxy (orange cloud) must be set to DNS only unless configured correctly; show a warning.
- Reject domains already in use by another store; reject our own root domain and reserved names.
- Rate limits: Vercel domain adds are limited per hour per team, so queue and throttle.
- No wildcard `*.ourdomain.com` is needed: creator links are path-based (D-010). Only custom domains need DNS records.
- Vercel Hobby is limited and non-commercial; use **Pro** for production (verify current terms and limits).
- Auth cookies are per domain. Keep creator login on the main domain (`/dashboard`). For buyers, the library stays on the main domain at first (magic-link access from the receipt email); per-domain buyer sessions are a later step.
- Security: verify ownership before activating, never trust a user-supplied `Host` without a DB match, log every domain change.

**Acceptance:** a test domain goes from added to live with HTTPS in under 30 minutes of DNS propagation; removing it restores the `/@username` URL; two stores cannot claim the same domain.

## 14. Import and export (Phase 3)

**Principle:** switching must take minutes, and leaving must be easy (export everything is also a trust and GDPR feature).

### 14.1 Import sources
| Source | What we can import | Method |
|---|---|---|
| **Gumroad** | Products (name, price, description), offer codes, customers and sales history, subscribers, license keys | **OAuth** with the Gumroad API (register our OAuth app), plus CSV export fallback |
| **Stan Store** | Customers and order history | **CSV upload** (Customers and Income exports). No public Stan API found. |
| **Any platform** | Email list | CSV upload (first name, last name, email) |
| Linktree and link-in-bio tools | Links, bio | Manual entry (copy helper); scraping only after checking terms |

**What cannot be imported automatically:** course videos and uploaded files (creator re-uploads originals), designs, and anything the source platform does not export. Say this clearly in the importer.

### 14.2 Import flow
1. Choose source, see exactly what will and will not be imported.
2. Connect (OAuth) or upload a CSV. Validate file type and size, parse in a background job.
3. **Preview and map columns**, show counts and problems (duplicates, missing names, invalid emails). Nothing is saved until the creator confirms.
4. Import as a job with progress, idempotent (re-running does not duplicate), with a downloadable error report.
5. Past buyers: create customer records and **enrollments** for the matching products so existing buyers keep access, once the creator has re-uploaded the files or recreated the products. The creator chooses whether to email buyers their new access link.

### 14.3 Consent and compliance (important)
- Imported contacts are **not automatically marketable**. Require the creator to confirm they have consent, and import marketing contacts with a status `imported_unverified`.
- Send a **re-permission email** (clear sender, why they are being contacted, one-click opt-in) before any marketing campaign. Transactional emails (receipts, access links) are fine.
- Respect CAN-SPAM, CASL (Canada: express consent) and GDPR/UK GDPR. Store consent source and timestamp per contact.
- Never import or store card numbers, payment methods or government IDs.

### 14.4 Security
- Treat all uploaded files as hostile: size limit, content-type check, CSV formula-injection sanitization on any re-exported cell, no server-side fetching of user-supplied URLs (SSRF).
- Store Gumroad OAuth tokens **encrypted**, request read-only scopes where possible, and revoke on completion.
- Rate limit import endpoints; imports run per store with RLS-scoped writes only.

### 14.5 Export (data portability)
"Export everything" in Settings: customers, orders, products, coupons, enrollments as CSV/JSON, delivered by email link that expires. Required for GDPR and a selling point ("no lock-in").

### 14.6 Founding creator concierge
For the first 10 creators, the founder migrates their store by hand and uses the findings to design the importer.
