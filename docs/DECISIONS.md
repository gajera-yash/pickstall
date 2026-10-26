# Decisions log

Short records of product and engineering decisions. Newest first. Each entry: date, decision, why, consequences. Do not edit past entries; add a new one that supersedes them.

---

## D-022: Database commands in CLAUDE.md
- **Date:** 2026-10-26
- **Decision:** `CLAUDE.md` section 3 lists `pnpm test:unit`, `pnpm test:db` and `pnpm db:push` instead of `supabase db reset`. `db reset` is only for CI or a local stack, never the hosted project. AI tools run lint, typecheck and unit tests; the founder pushes migrations and runs the DB tests.
- **Why:** `supabase db reset` contradicted D-001 (hosted dev project, no Docker).
- **Also:** the `landing/index.html` line is removed from `PHASE1_PLAN.md` section 1 (that file does not exist).

## D-021: External link products and the publish rule
- **Date:** 2026-10-26
- **Decision:** `products.external_url` (nullable, must start with `https://`, at most 2048 characters). A digital product can only be **published** when it has an `external_url` or at least one `product_files` row; a database trigger enforces this. `external_url` is never in public views: it is delivered only after a verified payment, like a file.
- **Known gap:** the trigger runs when a product is published or edited. Deleting the last file of a product that is already published is not blocked by the database; the app must guard it (Block C).
- **Resolves:** the open point in D-015 about where an external link lives.

## D-020: Taken username, Google users and users without a store
- **Date:** 2026-10-26
- **Decision:**
  - Step 1 of signup only **checks** that a username is free; it does not reserve it. The unique constraint on `stores.slug` is the final authority.
  - If the username is taken when the code is verified, the verified session is kept and the user goes to a **"Choose another username"** step (`/signup/username`).
  - **Google** users without a store go to the same username step (optional phone), then the same draft-store creation.
  - A user who signs in by email and has no store and no signup intent also goes to the username step, which offers a "Just buying? Go to your library" link. Buyers coming from checkout or the library keep their `next` path and never see it.
  - The username step shows "Step 2 of 2".
- **Resolves:** the D-008 open point and `PRD.md` open question 10.

## D-019: Signup intents (server-side signup details)
- **Date:** 2026-10-26
- **Decision:**
  - Signup step 1 saves the details (email, username, full name, optional phone) in a `signup_intents` table, not in auth metadata. Rows expire after 30 minutes; RLS is on with no policies (service role only); expired rows are deleted on every new signup.
  - **Bound to the browser:** the intent stores the hash of a random token; the token sits in an httpOnly, Secure, SameSite=Lax cookie. Only that browser can complete the signup. Without this, someone could start a signup with another person's email, and that person's next normal login would apply the attacker's username, name and phone.
  - **Rate limited:** at most 5 attempts per email in 15 minutes, and at most 10 intents per hour from one IP. The IP is never stored in plain form: only an HMAC-SHA-256 hash with the server secret `IP_HASH_SECRET`. Supabase's own email limits still apply.
  - When the code is verified, the server takes the intent (and deletes it), updates the profile (full name, phone) and creates the **draft store with the user's own session**, so RLS applies: slug = username, store name = full name (cut to 60 characters), currency USD. The existing trigger makes the user a creator.
  - Auth metadata is never trusted for the username or store creation. The `/onboarding` store step and the metadata pre-fill are removed.
  - `profiles.phone` becomes updatable by its owner (column grant), so the profile can be updated with the user's own session.
- **Supersedes:** the C3 rule that only the trigger may set the phone, and the C5 `/onboarding` flow.

## D-018: Token saving: read map and UI reference images
- **Date:** 2026-10-26
- **Decision:** the read map in `CLAUDE.md` section 1.1 now lists the real blocks (login, signup and dashboard, products and store page, payments, emails, security and deploy). UI reference images, when added, live in `docs/ui-reference/` and are named by screen (for example `signup.png`, `my-store.png`). An AI tool reads only the one image for the screen it is building, never the whole folder.
- **Why:** the spec files and images are large; reading everything on every task wastes tokens.

## D-017: Phase 1 is a 3-day plan
- **Date:** 2026-10-26
- **Decision:** Phase 1 becomes 3 days instead of 2.
  - **Day 1:** signup, Google sign-in, dashboard store setup, My Store with digital product customization, public store page, product page (Buy disabled).
  - **Day 2:** Stripe Connect (or MockProvider), checkout with creator fields, webhook, orders, Customers panel, buyer library, secure downloads, emails.
  - **Day 3:** security review, more payment methods, deploy, smoke test.
- **Why:** customization (D-013) and the Customers panel add real work; a 3-day plan is honest about it.
- **Consequences:** Phase 2 starts on day 4 (was day 3). `PHASE1_PLAN.md` and `PRD.md` section 8.1 are updated. The go/no-go rules do not change: a public launch with real money still needs the checklist in `PHASE1_PLAN.md` section 5.

## D-016: Payments: MockProvider for development, dynamic payment methods
- **Date:** 2026-10-26
- **Decision:**
  1. Payments stay behind the provider-agnostic `PaymentProvider` interface. The Stripe adapter (Connect Standard, direct charges, no application fee) is the real one.
  2. A `MockProvider` may be added **for development only** and is **disabled in production** (it must refuse to run when `NODE_ENV` is production). It goes through the same order and fulfilment path as Stripe: no shortcut that grants access without an order.
  3. Stripe Checkout uses **dynamic payment methods**, so creators in other countries can offer more methods. Exact availability must be verified in the Stripe docs during the payments block (no guessing).
  4. PayPal is a later adapter, only when the founder asks.
- **Conflicts with earlier text:** `CLAUDE.md` section 7 and `PHASE1_PLAN.md` Block D said "Stripe adapter only"; both are updated to allow the MockProvider.
- **Why:** lets Day 2 work continue if Stripe test keys or Connect are not available yet.

## D-015: Planned data model additions (not migrated yet)
- **Date:** 2026-10-26
- **Decision:** the customization features (D-013) need these additions. They are **planned only**: nothing is migrated until the founder approves the schema change (`CLAUDE.md` section 1, rule 4).
  - `products.settings jsonb` (button text, checkout headline, thank-you message, email subject and body, redirect URL, and so on)
  - `product_checkout_fields` table (up to 5 custom questions per product)
  - `orders.answers jsonb` (the buyer's answers, stored per order)
  - `customers` table (`store_id`, `email`, `name`, `phone`)
  - Each with RLS and tests: a creator can only see their own rows.
- **Design notes (from existing rules, not new decisions):** public views must expose only a whitelist of `settings` keys, because the confirmation email text and the redirect URL are not public (`CLAUDE.md` section 6). The "external link" delivery in D-012 does not fit `product_files.storage_path` (not null), so the schema work must decide where the link lives.

## D-014: Guardrails for customization
- **Date:** 2026-10-26
- **Decision:**
  - All creator text is sanitized and length-limited. No raw HTML, ever.
  - Sender identity and the download link are always included in emails, whatever the creator writes.
  - No sensitive questions at checkout (card numbers, ID numbers). Custom questions are text, long text, dropdown and checkbox only.
  - After-purchase redirect URLs must be `https`.
  - Creators are the data controller for their buyers' data. This is stated in the Terms.
  - CSV exports of customer answers must neutralize spreadsheet formulas (`PRD.md` section 14.4 already requires this for imports and exports).

## D-013: What creators can customize
- **Date:** 2026-10-26
- **Decision:**
  - **Store:** name, photo, bio, links, theme preset, accent color (with the contrast guard in `DESIGN.md` section 11).
  - **Product:** title, description, cover, fixed or pay-what-you-want price, button text, checkout headline, thank-you message, confirmation email subject and body (variables `{{customer_name}}`, `{{product_title}}`, `{{download_link}}`), download limit.
  - **Checkout fields:** name and email are always required; an optional phone toggle; up to 5 custom questions (text, long text, dropdown, checkbox, with a required flag).
  - Answers are stored per order and shown in the Customers panel, with CSV export.
- **Phase:** Phase 1 (Day 1 and Day 2 of D-017). Needs the schema work in D-015.

## D-012: Product type registry and type picker
- **Date:** 2026-10-26
- **Decision:** products are created through a type picker backed by a registry of types.
  - **Live in Phase 1:** Digital product (a file or an external link).
  - **Coming soon (shown with a "Coming soon" badge, not selectable):** Course, Coaching call, Membership, Collect emails, Link.
- **Why:** the picker sets the pattern now; later types plug into the registry without redoing the UI. "Coming soon" follows `DESIGN.md` section 15.

## D-011: Dashboard sections
- **Date:** 2026-10-26
- **Decision:** the creator dashboard has four sections: **My Store**, **Income**, **Customers**, **Settings**. Product management lives in My Store; the Customers panel shows orders' buyer details and custom answers (D-013).
- **Supersedes:** the nav in `PHASE1_PLAN.md` Block B (Overview, Products, Orders, Settings, Stripe) and the F8 section list in `PRD.md` for Phase 1.

## D-010: Path-based public URLs on one domain
- **Date:** 2026-10-26
- **Decision:** one domain, no subdomains:
  - Store: `pickstall.store/@username`; product: `pickstall.store/@username/product-slug`
  - Buyer library: `/library`; creator app: `/dashboard`
  - `/@username` is implemented with `next.config` **rewrites** to `/s/:username` (an `app/@...` folder would be a Next.js parallel route, so it cannot be used).
  - Custom domains (Phase 3) later map a host to a store.
- **Supersedes:** subdomain routing (`{slug}.ROOT_DOMAIN`, `app.ROOT_DOMAIN`) in `PRD.md` 5.2, section 13 and `PHASE1_PLAN.md` Block B. This also settles the domain part of `PRD.md` open question 1 (domain: `pickstall.store`).
- **Consequences:** `NEXT_PUBLIC_ROOT_DOMAIN` stays as the site's domain (no subdomain wildcard needed). `RESERVED_SLUGS` still protects names like `admin` and `support` from impersonation, even though `@` keeps stores out of app route names.

## D-009: Store setup lives in the dashboard
- **Date:** 2026-10-26
- **Decision:** store setup (name, avatar, bio, currency, theme, accent, link) is not part of signup. It is a first-run checklist in the dashboard: **Store setup, Add first product, Connect payments, Publish**.
- **Supersedes:** the "Store basics" step and the onboarding wizard in D-007 point 3, and the checklist in `DESIGN.md` 10.2 ("Connect Stripe, Add first product, Publish store").

## D-008: Signup is two steps, then the dashboard
- **Date:** 2026-10-26
- **Decision:**
  1. Signup is **2 steps**: details (username, full name, email, optional phone), then the 6-digit email code, then straight to `/dashboard`. No store setup, no activation page and no billing steps in signup.
  2. A **draft (unpublished) store is created automatically** at signup, using the username as its slug. The link is reserved and the user becomes a creator.
  3. **Google sign-in** is supported. New Google users get one extra step to choose a username (and an optional phone number).
  4. **Buyers never use signup.** They sign in with an email code at checkout or in the library.
- **Supersedes:** D-007 point 3 (signup steps: Store basics and the activation moment) and the `/signup` to `/onboarding` flow. D-007 points 1, 2 and 4 still stand (white theme, Stan-style layout with email code, billing steps are Phase 3).
- **Open points (not decided, need the founder):**
  - The draft store must be created **on the server after the code is verified**, and must not trust the username kept in client-editable auth metadata. What should happen if the username was taken in the meantime? (Sign-in must still succeed.)
  - The code built before this decision (the `/onboarding` store step, the activation page, the dashboard placeholder) no longer matches this flow and needs a later code task.

## D-007: White theme and a Stan-style signup flow
- **Date:** 2026-10-25
- **Decision:**
  1. White theme everywhere: page background `#FFFFFF`; everyday UI (inputs, cards, secondary buttons, alerts) uses a soft 1px `--border-ui` that keeps 3:1 contrast. 2px ink outlines and hard shadows stay on signature elements only (coupons, receipts, marketing mockups). DESIGN.md is now v1.1.
  2. Login and signup copy the structure of Stan Store's flow (white page, progress bar, one column, icon fields), with our own branding, words and blue. No emoji. Login stays passwordless (6-digit email code, D-002). Signup asks for username, full name, email and an optional phone number.
  3. Signup steps: Account, Verify (code), Store basics (currency and optional bio), activation moment, dashboard. The wizard is driven by a step list, so the Plan and Payment steps that Stan has can be inserted later.
  4. Plan and Payment steps are NOT built now. Platform billing is Phase 3 in PRD.md, needs a provider decision (Stripe Billing on the India platform account is invite-only, or a merchant of record) and a pricing decision, so a screen now would be a fake. Founding creators get 6 months free (PRD F9) and would skip these steps anyway.
- **Why:** the founder wants a professional white look and the proven Stan flow; the billing steps depend on Phase 3 decisions.
- **Consequences:** `profiles.phone` (optional) needs a migration; `/dashboard` is a 404 until the dashboard shell block.

## D-006: How design tokens are wired (step A2)
- **Date:** 2026-10-25
- **Decision:** `styles/tokens.css` is the only place for raw colors (plus `lib/themes.ts` for creator themes); a unit test fails if raw colors appear anywhere else. Tailwind's default palette and soft shadows are switched off, so only DESIGN.md colors exist. Dark mode follows the OS, with `<html data-theme="light|dark">` as an override. Components use token classes and never `dark:` variants.
- **Deviations from DESIGN.md (flag for the designer):**
  1. New token `--on-danger` (white in light, dark ink in dark). DESIGN.md 9.1 says destructive buttons use white text, but white on the dark-mode danger color `#FF7A7A` is about 2.2:1.
  2. New token `--on-yellow` (`#0B0D2A`), as DESIGN.md 16.4 implies.
  3. The global focus rule has no `border-radius: 4px`, which would square off rounded buttons when focused.
  4. Fonts use CSS variables `--font-bricolage` and `--font-instrument`, so `--font-display` can be the Tailwind name without clashing with next/font. Both fonts are variable (Bricolage keeps its optical-size axis).
  5. Text sizes `xs`, `sm` and `base` are raised to 13, 15 and 17px (Caption, Body S, Body), so nothing is below 13px.
  6. Hard shadows are the utilities `shadow-hard-sm|md|lg`; `shadow-overlay` is the soft overlay shadow.
  7. Components import `cn` from `lib/utils.ts`, not from the `cn` package. That file teaches the merger our custom text sizes (`text-button`, `text-h3`, ...) and hard shadows; otherwise it mistakes them for colors and drops classes. A test fails if `globals.css` gets a text size that is not registered there.
- **Known limit:** the loading spinner in a button is added before the label, so an auto-width button grows slightly while loading (full-width buttons do not change).

## D-005: Design tokens are a separate step (A2)
- **Date:** 2026-10-25
- **Decision:** Block A covers only the repo, schema, RLS and auth. Design tokens (`styles/tokens.css`, Tailwind theme, fonts, shadcn mapping, `lib/themes.ts`, contrast test) come in step A2, in its own commit, reading only DESIGN.md sections 3, 4, 6 and 16.
- **Why:** keeps Block A focused on the security-critical parts.
- **Consequences:** the Block A login page is a functional placeholder on shadcn defaults.

## D-004: Phase 1 schema changes from PRD 5.4 / 5.5
- **Date:** 2026-10-25
- **Decision:**
  - Lock sensitive columns: users cannot update `profiles.role`, `stores.owner_id`, `stores.stripe_account_id`, `stores.stripe_charges_enabled` or `stores.custom_domain`.
  - Creators get read-only access to `orders`, `order_items` and `enrollments`; only the service role (verified webhook) writes them.
  - Add `enrollments.download_count`.
  - Leave out the order-bump columns until Phase 2, and default `products.type` to `'digital'`.
  - Default store accent `#2F3BFF` (DESIGN.md Clean preset).
- **Why:** as written, PRD 5.5 would let a creator fake "Stripe connected" or edit orders. `download_limit` had no counter. Bumps are Phase 2.
- **Consequences:** a Phase 2 migration adds the bump columns. Block D increments `download_count` through the service role.

## D-003: Creator = owns a store
- **Date:** 2026-10-25
- **Decision:** one login for everyone. Anyone can buy. Creating a store makes the user a creator (`profiles.role` is set by a database trigger, never by the client). One store per creator in Phase 1 (`stores.owner_id` is unique).
- **Why:** a creator can also be a buyer; role escalation from the client is impossible.
- **Consequences:** `requireCreator()` means "signed in and owns a store".

## D-002: Email sign-in uses a 6-digit code
- **Date:** 2026-10-25
- **Decision:** email OTP as a 6-digit code (no magic link) for creators and buyers. Google is an extra option for creators.
- **Why:** a code works when the email is opened on a different device from the browser.
- **Consequences:** the Supabase "Magic Link" email template must show `{{ .Token }}`.

## D-001: Hosted Supabase dev project instead of local Docker
- **Date:** 2026-10-25
- **Decision:** no Docker. Development and database tests use the founder's **hosted Supabase dev project** (dev only, no real data). Migrations are applied with `supabase link` + `supabase db push`, not `supabase start` / `supabase db reset`.
- **Why:** avoids installing Docker/WSL2 tooling on the founder's Windows PC and saves setup time in the 2-day Phase 1.
- **Rules:**
  - All keys live in `.env.local` (git-ignored). Nobody pastes secrets into chat, issues or commits.
  - The founder runs `supabase login`, `supabase link` and `supabase db push`. AI tools only write migration files.
  - Never run `supabase db reset` against the hosted project. A pushed migration is never edited; fixes go in a new migration.
  - Database tests run **only** against the dev project. `tests/db/guard.ts` refuses to run unless all of these hold:
    1. `SUPABASE_DEV_PROJECT_REF` is set and well-formed.
    2. `NEXT_PUBLIC_SUPABASE_URL` is exactly `https://<ref>.supabase.co`.
    3. `DB_TESTS_ALLOW=dev-only` is set.
    4. The run is not production or CI.
    5. The ref matches the linked project (`supabase/.temp/project-ref`) when that file exists.
  - Tests create users with `@example.test` emails and a unique run id, and delete them afterwards.
- **Consequences:**
  - Auth settings (redirect URLs, email template, Google provider) are set in the Supabase dashboard, because `supabase/config.toml` only affects a local stack.
  - CI runs lint, typecheck, unit tests and build only. Adding DB tests to CI (using GitHub secrets for the dev project) is a Block F decision.
  - Production will be a **separate** Supabase project later; never point `.env.local` at it.
- **Supersedes:** the "local Supabase in Docker" choice in the Block A plan, and the `supabase db reset` command in CLAUDE.md section 3 (for now).
