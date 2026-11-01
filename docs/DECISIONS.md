# Decisions log

Short records of product and engineering decisions. Newest first. Each entry: date, decision, why, consequences. Do not edit past entries; add a new one that supersedes them.

---

## D-040: Landing page competes with Stan Store by name, with planned prices
- **Date:** 2026-11-01
- **Decision:**
  - Founder request: the landing page names Stan Store and shows the same kind of features at a lower price. This supersedes the "never name competitors" rule in `LANDING_PAGE_PROMPT_V2.md` section 3 for Stan Store only.
  - Stan Store facts come only from Stan's own help center (help.stan.store, "Creator vs Creator Pro" and "Creator Pro features", updated June 2026), checked 2026-11-01: Creator $29/mo, Creator Pro $99/mo, no free plan, and which plan includes which feature. Stan's fees and trial length are not stated there, so the page says nothing about them. The numbers live in `STAN` in `components/landing/content.ts` with the source and date; re-check before changing them.
  - Pickstall prices are the PRD F9 placeholders, shown as "planned": Starter $19, Pro $39 (`PLANNED_PRICE_CENTS` in `lib/config.ts`). Founding creators: 6 months free. Billing is still Phase 3.
  - Honesty: the feature table marks each Pickstall feature Live or Coming soon; it never says Stan lacks something; a footnote gives the source and date, says Stan Store is a trademark of its owner and that Pickstall is not affiliated.
  - Highlighted in: the announcement bar, a "Coming from Stan Store?" card in the hero, a "Vs Stan Store" nav link, a new section after the trust strip, an FAQ entry and the page description.
- **Why:** founder request, 2026-11-01. Naming a competitor is comparative advertising: claims must stay true and current, so the founder should have the copy checked before paid ads and re-check Stan's prices regularly.

## D-039: Marketing landing page with sign-up and log-in
- **Date:** 2026-11-01
- **Decision:**
  - `/` is the marketing landing from `LANDING_PAGE_PROMPT_V2.md`, adapted to the live product: every call to action goes to the real `/signup` or `/login` (signed-in visitors see "Go to dashboard"), so there is no waitlist backend. The final "Claim your stall" form runs the same live username check as signup and opens `/signup?username=...` prefilled; nothing is reserved until the account is created.
  - Built: announcement bar, sticky nav with a mobile menu, hero with the interactive "Build your stall" demo (name, shelf, "Make a sale", receipt with "Platform fee $0.00", running total; labelled Demo, client-side only), trust strip, fees section with an example receipt and the 10% example calculator, four steps, feature tiles with live theme and pay-what-you-want controls, founding offer coupon, FAQ, final call to action, footer.
  - Honesty: Phase 1 sells digital products, so the demo and copy say digital products; courses, coupons, order bumps, file uploads and the rest are tagged "Coming soon"; every 0% claim sits next to the Stripe card-processing note; mock data is labelled Demo or Example; no prices invented.
  - Light theme only (D-025 wins over the prompt's dark mode). No new dependency: CSS keyframes instead of the `motion` package; everything stops under reduced motion. Skipped for now: the pinned scroll story, device showcase, compare table, founder note (needs real name and photo), analytics and the OG image.
  - `pnpm dev:sandbox` runs the dev server on a throwaway in-memory MongoDB (port 3100), so UI can be previewed without touching the real database.
- **Why:** founder request, 2026-11-01.

## D-038: R9 security review and test setup
- **Date:** 2026-11-01
- **Decision:**
  - A payment event pays only the order whose provider and checkout session id match the event; refunds only touch orders of the same provider. Closes a cross-store unlock through a creator's own Stripe session (`docs/SECURITY_REVIEW_R9.md` F1).
  - Security headers for every route from `lib/security/headers.ts`. The CSP allows inline scripts (Next.js page data) instead of nonces, so public store pages stay cacheable.
  - New dev dependencies: `mongodb-memory-server` (integration and e2e tests start their own MongoDB, never the founder's) and `@playwright/test` (e2e smoke). `pnpm test` now runs unit + integration tests; `pnpm test:e2e` runs the smoke test on port 3100.
  - The load test is a small script without dependencies, limited to localhost unless `--allow-remote` is passed.
- **Why:** PRD R9 (sections 5.5 and 6).

## D-037: Buyer accounts: order email link, then a password (supersedes D-002 for buyers)
- **Date:** 2026-11-01
- **Decision:** after a paid (or free) order the buyer gets an order email with one unique link (`/welcome/<token>`). The link lets them create a password for the email they paid with, signs them in and opens their purchase in the library. Later they sign in with email and password (new "Password" tab on the login page); the email code still works and is the way back in after a forgotten password.
  - The token is 32 random bytes; only its SHA-256 is stored; it works for 30 days and for one password; saving a failed password gives the link back. The email link is the proof that the buyer owns that email. An account that already has a password is never changed (the buyer is sent to sign in).
  - Better Auth `emailAndPassword` is enabled with `disableSignUp: true`: nobody can register through the public endpoint (tested: 400). Accounts and passwords are created only by `lib/auth/buyer-account.ts` after the link check. Passwords are hashed by Better Auth, 8 to 128 characters. Password sign-in is rate-limited per email and per IP and answers "Email or password is incorrect" for both an unknown email and a wrong password.
  - The order email is sent after the response (`after()`), once per order (an `emailOutbox` row per order and kind; a failed send is kept as failed and retried the next time). The creator's own subject and message (R3) are used with the three allowed variables; the store name and the link are always in the email. `{{download_link}}` is the welcome link. Email HTML needs inline colors, so `lib/email/templates.ts` is allowed raw colors.
  - After sign-in, a user with no store but with purchases lands in `/library` instead of the creator setup step.
  - Known gaps: there is no "set a password" option inside the library for someone who signed in with a code; Resend delivers only to your own address until a sending domain is verified; failed emails are not retried by a timer yet.
- **Why:** founder request, 2026-11-01.

## D-036: R7 buyer library and secure delivery
- **Date:** 2026-11-01
- **Decision:**
  - Buyers sign in with the same 6-digit email code and see the paid and refunded orders placed with their verified email (`/library`, `/library/[orderId]`). No buyer password, no separate buyer account system.
  - The delivery link (`externalUrl`) never appears in a page or API response. The "Open your purchase" form POSTs to `/library/[orderId]/open`, which checks the same-origin `Origin`, the session, that the order is this buyer's and paid (a refund removes access), that the product still has a link, and the download limit, then redirects (303) to the stored https link with `Referrer-Policy: no-referrer`. POST only, so previews and prefetch cannot use up an open. The target comes from the database, never from the request.
  - The download limit is one atomic update on the order (`accessCount` below the limit), so parallel requests cannot both take the last use. The limit counts opens of the link; it cannot stop someone who already has the link from sharing it. Real file downloads with short-lived signed URLs need private file storage (not built; links only for now).
  - Refunds: the Stripe adapter turns a fully refunded `charge.refunded` into a refund event; the order is found through the PaymentIntent id saved when it was paid (`providerPaymentId`, unique index) and set to refunded. A partial refund keeps access. Creators refund in their own Stripe dashboard.
  - The thank-you page links to the library; the confirmation email with an access link comes with R8.
- **Why:** PRD F13 and F3b, R7.

## D-035: R6 orders, customers and income from paid orders
- **Date:** 2026-11-01
- **Decision:**
  - Customers are not a separate collection: they are derived from the store's paid orders (grouped by buyer email), so they cannot drift from the orders. The Customers panel shows totals, last order and each order's answers; the CSV export is `/dashboard/customers/export`.
  - Every query in `lib/orders/creator-queries.ts` starts from the `storeId` of the signed-in creator's store; tests assert it. Search text is escaped and never used as a regular expression; the query string is parsed by Zod and invalid values are dropped.
  - CSV cells starting with `=`, `+`, `-`, `@`, tab or CR get a leading apostrophe, so a buyer's text cannot run as a spreadsheet formula (D-014). A buyer handle like `@maya` therefore shows as `'@maya` in a spreadsheet. The export is rate-limited.
  - Income counts only paid orders in the store's currency; days are UTC; days without sales are real zeros. Orders from the development mock are labelled "Test".
  - Known gaps: the dashboard "Customers" KPI adds up distinct buyers per day, so a repeat buyer on two days counts twice; refunds arrive with R7; orders cannot be deleted.
- **Why:** PRD F8 and F12, R6.

## D-034: Stripe test account as the seller, and .env.local out of git
- **Date:** 2026-11-01
- **Decision:**
  - With a test key (`sk_test_`) and `STRIPE_PLATFORM_ACCOUNT_ID`, Settings > Payments offers "Use test Stripe account": the founder's own account becomes the store's seller account, so real Stripe Checkout can be tried before Connect OAuth exists. The adapter then makes a plain charge on that account (Stripe rejects "on behalf of" yourself). Never available with a live key. Real creators connect through Connect OAuth later (needs `STRIPE_CONNECT_CLIENT_ID`).
  - The Stripe provider is used only when the store has a seller account AND both `STRIPE_SECRET_KEY` and `STRIPE_CONNECT_WEBHOOK_SECRET` exist, because without the webhook a paid order could never be confirmed. Otherwise development falls back to the mock; production has no fallback.
  - Verified against Stripe test mode: the key is valid, the account id matches, and a Checkout Session request in our shape is accepted.
  - `.env.local` had been committed and pushed (commit 97c9217) and the `.env*` ignore rule was missing. The rule is restored and the file is untracked. The history still holds the old values, so the MongoDB password, `BETTER_AUTH_SECRET`, the Resend key and the Stripe key must be rotated (founder action).
- **Why:** founder shared Stripe test keys, 2026-11-01.

## D-033: R5 payments and checkout
- **Date:** 2026-10-31
- **Decision:**
  - `lib/payments/` holds a `PaymentProvider` interface, a Stripe adapter and a development-only `MockProvider`. Nothing outside this folder imports the Stripe SDK (new dependency `stripe`). The Stripe adapter creates Checkout Sessions as direct charges on the creator's account (`stripeAccount`), no application fee, and does not list payment methods, so Stripe's dynamic payment methods apply. It needs `STRIPE_SECRET_KEY` and `STRIPE_CONNECT_WEBHOOK_SECRET`; it is written to the documented API but **not yet run against Stripe** because no keys exist.
  - Fulfilment has one path (`lib/payments/process.ts`): verify the signature, insert the provider event id into `webhookEvents` first (a replay is a no-op), then move a pending order to paid. If the provider states an amount or currency that differs from our order, the order is not marked paid. The mock "pays" by sending a signed event into this same function; in production the mock and `/mock-pay` do not exist.
  - Checkout (`/@user/product/checkout`): buyer name and email, optional phone, the creator's questions (checked against the product's own definitions), and for pay-what-you-want an amount checked against the minimum and a maximum. The price always comes from the product in the database. The order is created before the provider is called; a free product takes a zero-amount order straight to paid. Rate limited per IP and per email. The thank-you page shows a message only and never grants access.
  - Orders are snapshots (title and price at the time). Not yet built, by design: Stripe Connect OAuth (needs the founder's Stripe client id), customers, income, emails and buyer library (R6 to R8).
- **Why:** PRD F4 and 5.6, R5.

## D-032: Image upload from the device, saved on our server
- **Date:** 2026-10-31
- **Decision:** the profile photo and product cover are uploaded from the creator's device; the "paste a link" fields are gone. `POST /api/uploads` (signed-in creators only, rate-limited) checks the file's own bytes (JPEG, PNG, GIF or WebP; SVG and anything else is refused; max 5 MB), saves it under a new uuid name and records it in the `uploads` collection. `GET /media/<id>` serves it with `nosniff` and a locked-down CSP. Images are public by design, since they appear on public pages.
  - Storage is behind a small interface (`lib/media/storage.ts`). The driver now writes to this server's disk (`UPLOAD_DIR`, default `.data/uploads`, git-ignored). That works for development and a single server; on AWS use a persistent volume or switch the driver to S3 before running several servers. Private product files (R7) will need private storage with signed URLs and are a separate decision.
  - Old https image links already saved keep working; new values must be an uploaded `/media/<id>`.
  - Known gaps: replaced or removed images stay on disk (cleanup job later), and images are not resized.
- **Why:** founder request, 2026-10-31.

## D-031: R4 public store and product pages
- **Date:** 2026-10-31
- **Decision:**
  - Public URLs `/@username` and `/@username/product` are served by `next.config.ts` rewrites to `app/s/[username]` and `app/s/[username]/[productSlug]` (D-010; an `@` folder would be a parallel route). Both pages set `instant = false` so a draft or unknown store is a real 404 and not a streamed page.
  - Public reads live in `lib/stores/public.ts` and use an explicit field allow-list (projection) plus `isPublished` / `status: "published"`. They never return the owner, Stripe ids, the delivery link, checkout settings or email texts; tests assert this.
  - The creator publishes the store from the store link card (`setStorePublishedAction`), which also makes the checklist's last step usable. A store can be published at any time; it just shows no products until one is published.
  - Pages use the creator's theme data (`lib/themes.ts`) with inline styles, an https-only avatar and cover, social links with `rel="noopener noreferrer nofollow"`, and per-page metadata (title, description, Open Graph).
  - The Buy button is disabled with an honest note until checkout (R5).
- **Why:** PRD F2 and F4, R4 of the build plan.

## D-030: R3 products (digital) and the creator-customization rules
- **Date:** 2026-10-30
- **Decision:**
  - New `products` collection (`lib/db/collections.ts`) with unique `{ storeId, slug }`. One type for now, `digital`. Money is integer cents; a creator types "19.99" and `lib/products/money.ts` converts it.
  - Editor at `/dashboard/products/[id]` with four tabs (Details, Checkout, After purchase, Settings) and a live preview. The form is sent as one JSON payload and validated again by Zod in `lib/products/schemas.ts`.
  - Guardrails (D-014): creator text has HTML tags and control characters stripped and is length-limited; emails allow only `{{customer_name}}`, `{{product_title}}`, `{{download_link}}`; up to 5 checkout questions (text, long text, dropdown, checkbox); questions that ask for card, ID, password or bank details are rejected; redirect, cover and delivery links must be https.
  - Publish rules (`lib/products/publish.ts`): a title, a delivery link (files arrive with R2), and for paid products connected Stripe. In development the MockProvider stands in, so paid products can be published; in production only a connected Stripe account counts.
  - Access control: every query filters by the `storeId` of the session owner (`requireCreator`). A product id from another creator behaves exactly like a missing one. Writes are rate-limited per owner. Published products cannot be deleted; archive first.
  - Delivery is an external link until R2 (private file storage) exists. Cover is an https link for the same reason.
  - Not done yet (planned): drag-to-reorder, duplicate, file upload (R2).
- **Why:** PRD F3 and F11; founder asked to continue with R3 without approval stops.

## D-029: Dashboard redesign from the founder's reference
- **Date:** 2026-10-29
- **Decision:** the dashboard follows `docs/ui-reference/dashboard.webp`. The founder asked for no more approval stops on design and code choices, so these were decided here:
  - Sidebar (256px, white): logo, eight sections (My Store, Products, Orders, Customers, Income, Marketing, Analytics, Settings), a Pro card and the signed-in creator. Mobile keeps the bottom bar: the first four sections plus "More" for the rest.
  - Top bar (64px): search box that opens a ⌘K / Ctrl+K command palette (pages and quick actions), "View my store" (opens the live preview until the public page exists), notifications popover (empty state), account menu.
  - My Store: welcome card with a greeting for the viewer's local time and an illustration made of tokens and icons; store link card with Copy, Customize and a draft notice; "Get started" checklist with step icons; "Last 30 days" with a 7/30/90-day picker and three KPI cards with sparklines; tabs Products / Store design / Links / Analytics with product search and "Add product"; right column (from 1280px) with the live store preview and a help card.
  - Honest data: KPIs and sparklines show real values (zero and a flat line until the first sale), never invented curves. "Upgrade to Pro" says "Coming soon" because paid plans are Phase 3 (PRD F9). Marketing tools are labelled "Coming soon" (Phase 2).
  - New token pair `--violet` / `--violet-soft` for the third data color (orders), icons and lines only.
  - `SUPPORT_EMAIL` (`support@pickstall.store`) in `lib/config.ts` for the help card; the founder must confirm the mailbox exists.
- **Why:** founder request with a full reference image, 2026-10-29.

## D-028: R1 design decisions: logo colors stay, one-page dashboard home, mobile bottom bar
- **Date:** 2026-10-29
- **Decision** (founder answers to `docs/AUDIT_R0.md` C1, C5, C6):
  - **C1, logo colors stay.** Blue `#0056FF` (hover `#0047D9`, pressed `#003BB5`, soft `#E6EEFF`), yellow `#FFC400`, Clean preset accent `#0056FF`. `DESIGN.md` sections 3, 3.1, 11 and 16 now follow the code. Every other DESIGN v2 token fix applies: `--border-ui` is renamed `--border-input` (`#7A8099`), `--line` (= DESIGN `--border`) is `#E5E7EB`, `--bg-subtle` `#F7F8FA`, `--mute` `#5B6078`, radii 8/12/16, `--shadow-popover`, shadcn `--muted` = `--bg-subtle`, `--accent` = `--blue-soft`, `--border` = `--line`, Body 15 px, inputs 44 px with 16 px text (no zoom on phones). The auth card from D-026 stays.
  - **C5, dashboard home is one page at `/dashboard`.** Greeting, store-link card with Copy, first-run checklist with a progress bar, KPI cards labelled "Example layout", then the tabs *Products* and *Page design*. No fifth nav item. Page design (theme and accent) is edited in that tab; Store setup is Settings > Store (`/dashboard/settings`, the Settings root; `/dashboard/store` redirects there) and keeps the profile: name, photo, bio, social links, currency and the username. Settings > Payments and Settings > Account are `/dashboard/settings/payments` and `/dashboard/settings/account`.
  - **C6, mobile keeps the bottom tab bar** (D-023) instead of a sheet; written into `DESIGN.md` section 5.
  - R1 defaults the founder approved: social links are a list of `{ kind, url }` (website, instagram, youtube, tiktok, x, linkedin, facebook; max 6; https only) that replaces the single `link` field (migration `scripts/migrations/2026-10-29-store-social-links.mjs`, run by the founder); a username can be changed 3 times per 24 hours, the old link stops working at once, and the unique index on `stores.slug` is the only authority.
- **Why:** founder decisions, 2026-10-29.
- **Supersedes:** the `--accent` workaround in D-027 (the command list now uses `--accent`, which is `--blue-soft`).

## D-027: Searchable country picker for the phone field
- **Date:** 2026-10-29
- **Decision:** the phone field's country code is a searchable dropdown (founder sketch): a trigger with the flag, dial code and chevron opens a shadcn `Popover` + `Command` list with a search box, flags, country names and codes. Search matches the name, ISO code or dial code; names that start with the search rank first. Picking a country moves focus to the number field.
  - New dependencies (founder asked for shadcn components and the full list): `cmdk` (shadcn Command), `libphonenumber-js` (every country, dial codes, and real per-country validation on the server in `optionalPhoneSchema`), `country-flag-icons` (SVG flags; DESIGN.md forbids emoji icons).
  - `components/ui/popover.tsx` and `components/ui/command.tsx` come from shadcn/ui, restyled with our tokens (the highlighted row is `--blue-soft`, because shadcn's `--accent` maps to yellow here).
- **Why:** founder request with a dropdown sketch, 2026-10-29.

## D-026: Logo colors, auth card and the live username check
- **Date:** 2026-10-28
- **Decision:**
  - The founder's logo (`public/brand/pickstall-logo.webp`) replaces the text wordmark everywhere (`components/brand/wordmark.tsx`).
  - Brand colors come from the logo: primary blue `#0056FF` (hover `#0047D9`, pressed `#003BB5`, soft `#E6EEFF`), secondary yellow `#FFC400` used very little. Everything else stays white, ink and greys. White on the new blue is 5.6:1 (was 6.6), still AA.
  - The default store accent (Clean preset) follows the brand blue: `#0056FF`.
  - Auth pages follow `docs/ui-reference/username.webp`: logo and tagline on a `--bg-subtle` (`#F7F9FC`) page and one white card with a soft `shadow-card`. This supersedes the "no card" rule of D-007.
  - The username field checks availability while typing (`lib/stores/username-check.ts`, rate-limited per IP) and offers up to three free suggestions. Suggestions use hyphens (`maya-store`), because usernames allow only letters, numbers and hyphens (dots and underscores are not valid in a store link).
  - The email code is entered in 6 boxes; the phone field has a country-code picker.
- **Why:** founder request with a reference image and the logo, 2026-10-28.

## D-025: White theme only, no OS dark mode
- **Date:** 2026-10-28
- **Decision:** the app always renders the white theme. `app/layout.tsx` sets `<html data-theme="light">`, so a creator whose computer is in dark mode still sees white pages. The dark tokens stay in `styles/tokens.css` (unused) in case a toggle is wanted later.
- **Why:** the founder saw the dark theme on a dark-mode PC and wants white everywhere (extends D-007).
- **Supersedes:** the "light and dark mode" rule in `DESIGN.md` sections 0 and 13 (updated).

## D-024: MongoDB and Better Auth replace Supabase
- **Date:** 2026-10-28
- **Decision:** the founder moved the database from Supabase (Postgres, Auth, RLS) to **MongoDB** with the official `mongodb` driver, and auth to **Better Auth** (`emailOTP` plugin for the 6-digit code, Google provider, database sessions, `nextCookies()`). Sign-in codes are emailed with Resend; in development without `RESEND_API_KEY` the code is written to the server log (never in production).
  - Collections: `profiles`, `stores`, `signupIntents` (TTL), `rateLimits` (TTL); Better Auth owns `user`, `session`, `account`, `verification`, `rateLimit`. Indexes are created by the app (`lib/db/mongo.ts`).
  - Authorization moves from RLS to the app: all data access goes through `/lib` functions that filter by the session user id.
  - Login code sends are rate-limited per email and per IP in MongoDB (`lib/rate-limit.ts`); Better Auth also limits its public `/api/auth/*` endpoints.
  - Store setup ships with a photo **link** field (https) instead of an upload until a storage service is chosen.
- **Supersedes:** D-001 and D-022 (hosted Supabase project, migrations, `db:push`, `test:db`) and the RLS parts of D-004. `PRD.md` (5.1, 5.3 to 5.6 and the related lines), `PHASE1_PLAN.md` and `CLAUDE.md` are updated to MongoDB. The publish rule of D-021 (needs a file or an external link) was a database trigger; it must now be enforced in `/lib` code (Block C).
- **Open:** file storage for avatars and product files (private, signed URLs); transactions (Better Auth runs without them so a standalone local MongoDB works).
- **Why:** founder decision, 2026-10-28.

## D-023: Dashboard shell and first-run checklist rules
- **Date:** 2026-10-26
- **Decision:**
  - The dashboard has a 248px sidebar on desktop and a bottom tab bar on mobile with the four sections (My Store, Income, Customers, Settings). The top bar shows the store name with a Draft or Live badge.
  - Checklist "done" rules: **Store setup** = the store has a photo or a bio; **Add first product** = at least one product; **Connect payments** = `stripe_charges_enabled`; **Publish** = `is_published`.
  - A step whose screen is not built yet shows a "Coming next" badge instead of a link to an empty page (honest UI, `DESIGN.md` section 15). Flip it in `lib/dashboard/checklist.ts` when the block ships.
  - Income and Customers show honest empty states until checkout exists (Block D).
- **Why:** founder answer B4 in the rework plan; D-009 and D-011.

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
