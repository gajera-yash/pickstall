# Audit R0: code vs PRD v2 and DESIGN v2

> Date: 2026-10-29. Block R0 from `PRD.md` sections 0 and 8. Audit only: no code was changed, nothing was run against the database.
> Read: `PRD.md` (v2, whole), `DESIGN.md` (v2) sections 0, 3, 5, 6, 9, 10, 11, 16, `CLAUDE.md`, `docs/DECISIONS.md` (D-001 to D-027).
> Compared with: `app/`, `components/`, `lib/` (`db`, `auth`, `stores`, `dashboard`, `config`, `themes`), `styles/tokens.css`, `app/globals.css`, `next.config.ts`, `package.json`.
> Rule applied: **existing working code and names win** unless they break a security rule; every difference below comes with a proposal, not a rewrite.
> `docs/DATABASE.md` does not exist, so the field-level comparison PRD 5.4 asks for is only possible against the collection list and rules in PRD 5.4 / 5.5.

---

## 0. Founder decisions (2026-10-29, after this audit)

- **R0 approved.** The R1 plan in section 5 is approved, including the social-links schema change (founder runs the migration).
- **C1: keep the logo colors (D-026).** Blue `#0056FF` (hover `#0047D9`, active `#003BB5`, soft `#E6EEFF`), yellow `#FFC400`, Clean accent `#0056FF`. R1 updates `DESIGN.md` sections 3, 3.1, 11 and 16.2 to these values (DESIGN follows the code here) and adds a decision entry. All other DESIGN v2 token changes in section 2.1 still apply. The auth card from D-026 stays too unless the founder says otherwise.
- **C5: dashboard home = one page at `/dashboard`, "very modern and user friendly".** Greeting, store-link card with Copy, first-run checklist, KPI example cards, then the Products / Page design tabs. No fifth nav item.
- **C6: keep the bottom tab bar on mobile (D-023).** R1 adds it to `DESIGN.md` section 5 instead of the sheet.

---

## 1. Exists and matches

**Auth and signup (F1)**
- Better Auth on MongoDB, email 6-digit code (`emailOTP`, 6 digits, hashed, 5 attempts) and Google (`lib/auth/auth.ts`). No passwords.
- Two-step signup: details saved server-side in `signupIntents` (TTL 30 min, bound to the browser by an httpOnly / SameSite=Lax cookie, rate limited per email and IP), then the code; draft store created on success with slug = username, name = full name, currency USD, then `/dashboard` (`lib/auth/complete-signup.ts`, `lib/stores/create-draft-store.ts`).
- Login: same response whether or not the email exists; resend cooldown 30 s (`OTP_RESEND_COOLDOWN_SECONDS`); send-code rate limits per email and IP (`lib/rate-limit.ts`).
- Google users without a store go to the username step (`/signup/username`, D-020) before the draft store is created. So the PRD R1 item "Google sign-in if missing" is **already done** on the login page.
- Taken username at creation: verified session kept, user sent to "Choose another username" (`USERNAME_PATH`); unique index `stores_slug_unique` is the final authority.
- Username rules validated server-side (`lib/slug.ts`): stricter than the PRD regex (no leading/trailing hyphen, no `xx--`), reserved list rejected with the same message as "taken" (no enumeration of the reserved list).
- Safe `next` redirects (`lib/auth/redirect.ts`), redirects built from `NEXT_PUBLIC_APP_URL`, not the Host header (`app/auth/callback/route.ts`). OAuth `state` is checked by Better Auth.
- Live username check with suggestions, rate limited per IP (D-026). Six-box OTP input, searchable phone country picker (D-027).

**Data and tenant isolation (PRD 2.5, 5.5)**
- MongoDB official driver, no ORM (`lib/db/mongo.ts`); answers PRD open question 5 (driver, not Mongoose).
- Uniqueness by indexes, not check-then-insert: `stores.slug`, `stores.ownerId` (one store per owner), `signupIntents.email`; TTL indexes on `signupIntents` and `rateLimits`; Better Auth indexes.
- All store access goes through `lib/stores/queries.ts`, filtered by the owner id from the verified session (`requireCreator`). Store setup never writes slug, Stripe or publish fields (`storeSetupInput`).
- `MONGODB_URI` / `BETTER_AUTH_SECRET` used only in server files with `import "server-only"`.

**Config and customization rules**
- `lib/config.ts` holds `APP_NAME`, `ROOT_DOMAIN`, `RESERVED_SLUGS`, `PLAN_LIMITS`, currencies USD/GBP/CAD.
- Store text sanitized and length-limited (name 60, bio 200, control characters rejected), https-only URLs without credentials (`lib/stores/schemas.ts`).
- Themes are data (`lib/themes.ts`: Clean, Bold, Soft) with an accent contrast guard (`onAccentFor`, rejected below 4.5:1, live "button preview" in the form). Bold and Soft values match DESIGN 11.
- Tokens are tested (`tests/unit/tokens.test.ts`, `themes.test.ts`); DESIGN 16.5 asks for exactly this.

**Dashboard (F8, D-009, D-011, D-023)**
- Four sections My Store, Income, Customers, Settings with the DESIGN 8 icons (`lib/dashboard/nav.ts`, `components/dashboard/dashboard-nav.tsx`).
- First-run checklist with the four steps and honest "Coming next" badges for screens not built (`lib/dashboard/checklist.ts`).
- Store setup inside the dashboard (`/dashboard/store`): name, photo, bio, link, currency, theme, accent.
- Income and Customers show honest empty states, with "Stripe's card processing fees still apply" next to the 0% claim.
- Loading states via `Suspense` + skeletons, `app/dashboard/error.tsx` for errors.

**Design basics**
- Fonts Bricolage Grotesque + Instrument Sans via `next/font` (`display: swap`, latin). Light only (`data-theme="light"`, D-025). Global `:focus-visible` blue 3 px ring. Reduced-motion rule. Tailwind default palette removed, so raw colors cannot be used.
- Button sizes match DESIGN 9.1: `sm` 36 px (`h-9`), default 44 px (`h-11`), `lg` 52 px (`h-13`); loading state with spinner and `aria-busy`.
- Auth progress bar "Step 1 of 2" with `role="progressbar"` (`components/auth/wizard-progress.tsx`).

---

## 2. Exists but differs

### 2.1 Tokens (`styles/tokens.css`, `app/globals.css`) vs DESIGN v2 section 3 / 6 / 16

Several code values come from **D-026 (logo colors, 2026-10-28)**, which DESIGN v2 does not mention. See contradiction C1 before changing anything.

| DESIGN v2 | Code | Note / proposal |
|---|---|---|
| `--bg-subtle #F7F8FA` | `#f7f9fc` | D-026. Decide C1. |
| `--mute #5B6078` | `#555a82` | Pick DESIGN value (6.2:1) unless founder prefers current. |
| `--border #E5E7EB` (decorative) | `--line #cfd3f5` | **Name clash:** in code `--border` is the shadcn alias = `--border-ui` (strong). Proposal: keep the token name `--line` in code (Tailwind `border-line`), set its value to `#E5E7EB`, and record in DESIGN that `--line` = DESIGN `--border`. |
| `--border-input #7A8099` | `--border-ui #878cb0`; shadcn `--input`/`--border` both = `--border-ui` | Proposal: rename `--border-ui` to `--border-input` (DESIGN name) with value `#7A8099`; keep `--input` = `--border-input`, set shadcn `--border` = `--line`. Mechanical rename: 7 `border-border-ui` and 7 `border-input` class usages in `app/` and `components/`. |
| `--blue #2F3BFF`, hover `#2430D6`, active `#1B26B8`, soft `#EEF0FF` | `#0056ff`, `#0047d9`, `#003bb5`, `#e6eeff` | D-026 logo blue. Decide C1. |
| `--yellow #FFD84D`, `--yellow-soft #FFF6D6` | `#ffc400`, `#fff4cc` | D-026. Decide C1. |
| `--mint-soft #E3F6EE`, `--danger-soft #FDECEC`, `--warning-soft #FFF3D1` | `#ddf5ea`, `#fde3e3`, `#fff1c2` | Small drift; adopt DESIGN values. |
| radius sm 8 / md 12 / lg 16 / full | xs 6 / sm 10 / md 14 / lg 20 / xl 28 | Adopt DESIGN values; keep `xs`/`xl` only if still used (marketing). |
| `--shadow-popover 0 8px 24px rgb(11 13 42/.12)` | `--shadow-overlay 0 12px 32px /.18`; plus hard shadows `--shadow-sm/md/lg`, `--shadow-card` | Rename to `--shadow-popover` with DESIGN value; keep hard shadows only for the marketing landing (DESIGN 7); `--shadow-card` (auth card, D-026) conflicts with "no shadow on cards" (C1). |
| `--dur-slow 320ms` | `360ms` | Adopt 320. |
| (not in DESIGN) | `--on-yellow`, `--on-danger`, `--border-strong`, `--scrim`, `--ease-in-out`, dark block | Keep (useful, tested); add them to DESIGN 16.2 so the doc matches. Dark block is unused (D-025); keep or delete, founder's call. |
| Font vars `--font-heading`, `--font-body`; Tailwind `font-heading` | `--font-bricolage`, `--font-instrument`; Tailwind `font-display` | Keep code names (`font-display` used everywhere); update DESIGN 16.1/16.3. |
| Tailwind `--color-subtle` | `--color-bg-subtle` (`bg-bg-subtle`) | Keep code name; update DESIGN 16.3. |
| shadcn `--muted`=`--bg-subtle`, `--accent`=`--blue-soft` | `--muted`=`--blue-soft`, `--accent`=`--yellow` | Adopt DESIGN mapping. D-027 already had to work around `--accent`=yellow in `command.tsx`; after the fix that workaround can go. |
| Charts: blue, mint, ink, mute (max 4) | chart-1..5 includes yellow | Adopt DESIGN order. |
| Focus `outline-offset: 2px` | `3px` | Adopt 2px. |
| Type: Body 15 px, Body S 14, Body L 17, Button 15, H1 1.75rem, H2 1.375rem, H3 1.125rem, Money L 2rem, Money M 1.25rem | `text-sm` 15, `text-base` 17 (body default), `text-button` 16, `text-h1` clamp 1.75–2.25, `h2` 1.5, `h3` 1.25, `money-m` 1.5, `money-l` clamp 2–3 | Body text in code is 17 px, DESIGN says 15 px. Proposal: remap the scale to DESIGN (`text-base` = 15, `text-sm` = 14, `text-body-l` = 17, …). This changes every screen slightly; do it once in R1 and re-check 360 px. |
| `color-scheme: light dark` on `:root` | — | Harmless with `data-theme="light"`; can become `light`. |

### 2.2 Components (`components/ui/`) vs DESIGN 9

| Component | DESIGN v2 | Code | Proposal |
|---|---|---|---|
| Input (9.2) | 44 px high, radius md (12), `--border-input` | `h-12` (48 px), `rounded-sm` (10 px), `border-input` → `--border-ui` | `h-11`, `rounded-md`; border follows the token rename. Also select/textarea/icon-input/phone field. |
| Button secondary / ghost hover | `--bg-subtle` | `bg-blue-soft` | Switch to `bg-bg-subtle`. Extra `highlight` variant (yellow, hard shadow) is marketing-only: keep but do not use in the app. |
| Card (9.4) | 1px `--border` (decorative), no shadow | `border-border-ui` (strong) | Use `border-line`; clickable cards hover to `--border-input`. Same for checklist and settings sections that hand-roll card classes. |
| Badge (9.5) | Draft = `--bg-subtle` + `--mute`; Example = `--bg-subtle` + border; also Paid, Refunded, Test mode | Draft = `blue-soft` + ink; Example = border only; no Paid / Refunded / Test mode | Fix Draft/Example; add `testMode` in R1 (Settings › Payments needs it), Paid/Refunded in R6. |
| Navigation (9.8) | sidebar item 40 px, active `--blue-soft` | check in R1 (bottom tab bar items are `min-h-14`) | Align during the shell work. |

### 2.3 Dashboard shell and pages vs PRD F8 and DESIGN 5 / 10.2 / 10.8

| Area | PRD / DESIGN | Code | Proposal |
|---|---|---|---|
| Sidebar width | 240 px | `w-62` = 248 px (D-023) | 240 px (`w-60`). |
| Top bar | 56 px; breadcrumb, "View my store", account menu | 64 px; logo (mobile) + store name + Draft/Live badge | Rebuild per F8; keep the status badge next to the breadcrumb. |
| Content | max 1120 px, padding 24 / 16 px, page bg `--bg-subtle`, cards white | max 1200 px, page bg white (`bg-background`) | Adopt DESIGN. |
| Mobile nav | sidebar "collapses to a sheet" | bottom tab bar (D-023) | See contradiction C6. |
| Home (`/dashboard`) | H1 "Welcome, {name}", store-link card (link, Copy, status badge), checklist card, KPI cards with "Example layout" | H1 "My Store", link as text (no Copy), checklist, products empty state | Add greeting, link card with Copy (DESIGN 9.14 chip), KPI example cards; keep products section under My Store tabs (see C5). |
| My Store tabs | *Products* and *Page design* | none | Add tabs in R1 (Products shows the empty state until R3; Page design = theme + accent). |
| Checklist (10.8) | title "Get started", progress bar + "1 of 4 done", rows "Add your first product", "Publish your store", chevron button per row, next row highlighted `--blue-soft` | title "Get your store ready", text count only, labels "Add first product", "Publish", one primary button at the bottom | Align copy and add progress bar, row chevrons, next-row highlight. Keep the "Coming next" rule (D-023). |
| Checklist "Store setup" done rule | not specified | photo or bio (D-023) | Keep. |
| Store setup (F8, 10.3) | name, avatar (upload), bio, **social links**, currency, theme, accent, link display with **Change** username; editor layout with sticky phone preview, Save draft / Publish | name, **photo link** (D-024, no storage yet), bio, **one** `link`, currency, theme, accent; single column, "Save store"; no username change; preview only for the accent button | Keep the fields; add social links list (schema change, see 3), username Change (R1), editor layout with live preview. Avatar upload waits for R2. |
| Settings (10.2) | left sub-nav Store / Payments / Account, single-column form card | one page with Account and Payments cards; Store setup is a separate route | Add the sub-nav; "Store" item links to (or hosts) store setup; add Payments test-mode badge placeholder and Account fields (name, email, phone, delete request). |
| Signup page (10.7) | "or" divider + "Continue with Google" on signup too | Google button only on `/login` | Add the Google button to signup step 1 in R1. |
| Auth layout (10.7) | white page, no card, max 420 px | `--bg-subtle` page + white card with `shadow-card`, `max-w-md` (448 px) (D-026) | See C1. |

### 2.4 Data model and names vs PRD 5.4 / 5.5 (no `docs/DATABASE.md` to compare fields)

| PRD v2 | Code | Proposal |
|---|---|---|
| Collections `users`, `sessions`, `auth_otps`, `signup_intents` | Better Auth owns `user`, `session`, `account`, `verification`, `rateLimit`; app has `profiles`, `stores`, `signupIntents`, `rateLimits` (D-024) | **Keep code names.** Better Auth's names cannot change without its config, and renaming live collections needs a migration. Update PRD 5.4 / DATABASE.md to these names. |
| Collection names snake_case (`store_stats_daily`, `webhook_events`) | camelCase (`signupIntents`, `rateLimits`) | Agree one convention before R2 creates `files`; proposal: camelCase to match what exists. |
| Every tenant doc has `storeId` | `stores` is keyed by `ownerId` (unique); no other tenant collections yet | Keep `ownerId` on `stores`; new tenant collections (files, products, …) carry `storeId` **and** are queried via the owner's store. |
| Repository context (`actorId`, `storeId`, role) | functions take `ownerId` only | Fine for now; introduce a small `CreatorContext { userId, storeId }` in R2/R3 when the second tenant collection appears. |
| Guards `requireUser`, `requireStoreOwner`, `requireEntitlement` | `requireUser`, `requireCreator` (= store owner) | Keep `requireCreator` (CLAUDE.md uses it); `requireEntitlement` arrives in R7. |
| Locked fields `users.isCreator`, `stores.payments.*`, `stores.planTier` | creator = owns a store (D-003, no flag); `stripeAccountId`, `stripeChargesEnabled` flat on `stores`; no plan field | Keep flat Stripe fields; when R5 adds payouts/status, either keep flat (`stripePayoutsEnabled`) or move to `payments.*` with a migration. Founder decides then. |
| Money fields `...Minor` (`amountMinor`) | CLAUDE.md says "integer cents"; no money fields yet | Use `...Minor` names from R3 on; no conflict with code yet. |
| `schemaVersion` on documents | none | Add `schemaVersion: 1` on new collections from R2; existing `stores` / `profiles` get it with the first migration that touches them. |
| Store `currency` "USD, GBP, CAD" | stored lowercase `usd` (Stripe style), labelled uppercase | Keep. |
| Store "social links" | single `link: string \| null` | Schema change (array of `{ kind, url }`, max ~6, https only) needs founder approval; migration copies `link` into it. |

### 2.5 Smaller differences
- `RESERVED_SLUGS` lacks **`signup`** and **`checkout`** from PRD 5.2. It has extra entries (`assets`, `auth`, `blog`, `mail`, `onboarding`, `s`, `static`, `status`), which is fine. Proposal: add the two (config-only change, existing stores unaffected unless someone already took them).
- `PLANS` is `trial, starter, pro, business`; PRD F9 has `Founding, Starter, Pro, Business`. Not used in Phase 1; rename `trial` → `founding` when billing starts. No `can(plan, feature)` helper yet (Phase 3).
- `lib/slug.ts` comment says the username becomes `{slug}.ROOT_DOMAIN`; links are path-based (D-010). Comment only.
- Dashboard metadata / copy: Income empty state wording is fine; DESIGN 10.2 wants the "Platform fee $0.00" tag only once orders exist.

---

## 3. Missing (Phase 1 scope)

Grouped by the PRD block that should build it.

- **R1:** top bar breadcrumb, "View my store", account menu; mobile sheet nav (or keep bottom bar, C6); dashboard home greeting, link card with Copy, KPI example cards; My Store tabs; checklist progress bar and row actions; Settings sub-nav and Account fields; username **Change** (unique, rate limited); social links; Google button on signup; editor layout with live preview for store setup. UI pieces not yet in `components/ui/`: **dialog/sheet, dropdown menu, tabs, toast, progress bar, switch, segmented control, tooltip** (all shadcn; `radix-ui` is already a dependency, so no new package is needed except possibly a toast library: ask first).
- **R2:** file storage (S3 or other: undecided, C3), `files` collection, presigned upload, avatar and cover upload.
- **R3:** products, type registry, type picker, digital editor (4 tabs), checkout-fields builder, publish rule in `/lib` (was a Postgres trigger, D-021/D-024).
- **R4:** `/@username` rewrite in `next.config.ts` (none yet), store and product pages, draft-store 404, caching.
- **R5 to R8:** `lib/payments/` (`PaymentProvider`, MockProvider, Stripe), checkout, `orders`, `customers`, `entitlements`, `store_stats_daily`, `webhook_events`, `outbox_events`, `email_log`, `audit_logs`, worker, `/library`, transactional emails beyond the login code. `/checkout/success` route.
- **R9 / tooling:** ESLint rule that blocks DB access outside repositories (PRD 5.5.1; `eslint.config.mjs` has none); `$`-key / dotted-key rejection helper for NoSQL injection (Zod objects are strict today but there is no shared guard); cross-tenant test suite (unit tests mock the DB; no DB-backed tests since D-024); Playwright and `pnpm test:e2e` (listed in CLAUDE.md section 3, not in `package.json`); security headers / CSP (`next.config.ts` has none); Sentry and PostHog (not installed); `.env.example` check for AWS variable names if AWS is chosen.
- Session cookie flags (`httpOnly`, `Secure`, `SameSite=Lax`) rely on Better Auth defaults (Secure only when the base URL is https). Not verified in a running build; check in R9.

---

## 4. Contradictions between the docs

| # | Where | Contradiction | Proposed resolution |
|---|---|---|---|
| C1 | DESIGN v2 section 3/5/10.7 vs DECISIONS D-026 | DESIGN v2 uses blue `#2F3BFF`, yellow `#FFD84D`, `--bg-subtle #F7F8FA`, auth on a white page with **no card**. D-026 (founder's logo) set blue `#0056FF`, yellow `#FFC400`, auth on `--bg-subtle` with a white card and soft shadow. DESIGN v2's changelog does not say it supersedes D-026. | **Founder decides.** If the logo colors stay, update DESIGN 3 / 3.1 / 16.2 / 10.7 (contrast for `#0056FF` is 5.6:1, already tested). If DESIGN v2 wins, add D-028 superseding D-026 and change only `tokens.css` + `lib/themes.ts` + auth shell. |
| C2 | PRD header, 5.4, F5, 5.7 | Points to `docs/DATABASE.md` (50 collections) and `ARCHITECTURE.md`; **neither file exists** in the repo. PRD 5.4 now defers the whole data model to DATABASE.md, while CLAUDE.md section 4/6 says `lib/db/collections.ts` + `lib/db/mongo.ts` are the source of truth. | Add the two files, or point PRD at `lib/db/collections.ts`. Proposal: `lib/db/collections.ts` stays the source of truth for built collections; DATABASE.md (when added) is the plan for future ones. |
| C3 | PRD header / 5.1 / F3b / R2 / R10 vs CLAUDE.md section 2 and D-024 | PRD: "Node.js + MongoDB (Atlas) + **AWS**", S3 + CloudFront, Redis, Secrets Manager, ECS. CLAUDE.md: "File storage … **not decided yet**; ask the founder". PHASE1_PLAN.md: Vercel + Vercel Cron. | Founder confirms AWS S3 for R2 and AWS for deploy; then update CLAUDE.md section 2 and add a decision entry. Redis is a new dependency: ask before R9. |
| C4 | PRD 5.1 / 5.6 D vs CLAUDE.md section 2 / 7 | PRD: a Node.js worker + `outbox_events`, Redis. CLAUDE.md: **Inngest** for background jobs, Mux, PostHog. PHASE1_PLAN Block E: `email_outbox` + Vercel Cron instead of Inngest. Three different job systems. | Pick one before R6. Proposal: outbox collection + one worker (fits AWS, no new vendor); update CLAUDE.md. |
| C5 | PRD F8 vs DESIGN 10.2 | PRD sidebar has no "Home": `/dashboard` is My Store with tabs Products / Page design. DESIGN 10.2 describes a "Home" (greeting, link card, checklist, KPI cards). | Proposal: `/dashboard` = My Store page that **starts** with greeting + link card + checklist + KPI example cards, followed by the Products / Page design tabs. One page, no fifth nav item. |
| C6 | DESIGN 5 vs D-023 | DESIGN: sidebar collapses to a sheet on mobile. D-023: bottom tab bar on mobile (built). | Founder decides; bottom bar is built and thumb-friendly. If kept, add it to DESIGN 5. |
| C7 | PRD 5.3 vs CLAUDE.md 4 | PRD: monorepo `apps/web`, `apps/worker`, `packages/core`, ESLint rule against model access outside `packages/core`. CLAUDE.md and the repo: single app, logic in `/lib`. PRD itself says "keep it and document it". | Keep `/lib`; update PRD 5.3; the ESLint rule targets `lib/db/` imports outside `lib/**/queries.ts` (repositories). |
| C8 | CLAUDE.md vs PRD block names | CLAUDE.md read map (1.1) uses blocks A–F and milestones M0–M11; PRD v2 uses R0–R10. PHASE1_PLAN.md still describes the 3-day A–F plan (D-017). | Update the CLAUDE.md read map to R0–R10 (it saves tokens only if it points at the right sections); mark PHASE1_PLAN.md as superseded or align it. |
| C9 | CLAUDE.md section 7 vs PRD F9 | CLAUDE.md: platform revenue "only through Stripe Billing subscriptions". PRD F9: billing provider decided in Phase 3, possibly a Merchant of Record (Dodo Payments). | Not urgent (Phase 3); note in CLAUDE.md that the billing provider is open. |
| C10 | CLAUDE.md section 5/6 wording | "Timestamps are `timestamptz`", "no raw SQL", `stripe_account_id`, "migration files" are Postgres leftovers; code uses `Date` (UTC) and camelCase fields. | Wording fix in CLAUDE.md. |
| C11 | PRD 5.2 vs `lib/config.ts` | PRD reserved list includes `signup`, `checkout`; config lacks them. | Add to config (2.5). |
| C12 | DESIGN 0.2 / 16.2 vs D-025 | DESIGN: "do not build dark mode now". Code keeps an unused dark token block (D-025 says keep for later). | Harmless; founder may delete it to match DESIGN. |
| C13 | CLAUDE.md section 3 vs `package.json` | `pnpm test:e2e` (Playwright) listed but not installed. | Add in R9 (new dependency: ask). |

---

## 5. Proposed plan for R1 (dashboard shell + store setup)

Founder answers are in section 0: logo colors stay, one-page modern home, bottom tab bar on mobile, social-links schema change approved. No new dependency is planned; shadcn components come from the existing `radix-ui` package.

**Step 1: tokens and base components (one commit)**
- `styles/tokens.css`, `app/globals.css`: rename `--border-ui` → `--border-input`, set `--line` to DESIGN `--border`, radii 8/12/16, `--shadow-popover`, `--dur-slow`, shadcn mapping (`--muted`, `--accent`, `--border`), chart order, focus offset, type scale per DESIGN 4; blue and yellow stay the logo colors (C1). Update `DESIGN.md` 3, 3.1, 5 (bottom tab bar), 11, 16 and add a `docs/DECISIONS.md` entry for C1/C5/C6.
- `lib/themes.ts`: Clean preset to DESIGN 11 (`text #0B0D2A`, `card #F7F8FA`, radius 12), accent stays `#0056FF`.
- `tests/unit/tokens.test.ts`, `tests/unit/themes.test.ts`: new pairs from DESIGN 3.1.
- `components/ui/input.tsx`, `select.tsx`, `textarea.tsx`, `icon-input.tsx`, `components/auth/phone-field.tsx`: 44 px, radius md.
- `components/ui/button.tsx`, `card.tsx`, `badge.tsx`: hover colors, card border, badge variants (+ `testMode`).
- `components/ui/command.tsx`: drop the `--accent` workaround once `--accent` = `--blue-soft`.
- Replace `border-border-ui` usages across `components/` and `app/` (mechanical).

**Step 2: shell**
- `app/dashboard/layout.tsx`: 240 px sidebar, 56 px top bar, `--bg-subtle` page, 1120 px content.
- New `components/dashboard/top-bar.tsx` (breadcrumb, status badge, "View my store" disabled with "Coming soon" until R4, account menu with sign out).
- New `components/ui/dropdown-menu.tsx`, `tabs.tsx`, `progress.tsx`, `dialog.tsx` (shadcn, restyled). Mobile keeps the bottom tab bar (C6).
- `components/dashboard/dashboard-nav.tsx`, `lib/dashboard/nav.ts`: 40 px items, breadcrumb labels.

**Step 3: My Store home**
- `app/dashboard/page.tsx`: greeting, new `components/dashboard/store-link-card.tsx` (link chip + Copy + badge), checklist, KPI example cards, tabs Products / Page design.
- `components/dashboard/checklist-card.tsx`, `lib/dashboard/checklist.ts`: "Get started", progress bar, row chevrons, next-row highlight, labels per DESIGN 10.8; tests in `tests/unit/dashboard.test.ts`.

**Step 4: store setup and settings**
- `app/dashboard/store/page.tsx`, `components/dashboard/store-setup-form.tsx`: editor layout (form cards + sticky phone preview, preview behind a button on mobile), social links list, username **Change** dialog.
- `lib/stores/schemas.ts`, `lib/stores/queries.ts`, `lib/stores/actions.ts`: social links schema; `changeUsername(ownerId, slug)` relying on `stores_slug_unique`, rate limited (`lib/rate-limit.ts`), reserved list check; ownership tests.
- `lib/db/collections.ts`: `socialLinks` on `StoreDoc` (**schema change, approval needed**) + a written migration script for the founder to run (copies `link`).
- `lib/config.ts`: add `signup`, `checkout` to `RESERVED_SLUGS`; social link limits.
- `app/dashboard/settings/` : layout with sub-nav (Store, Payments, Account), `payments/page.tsx` (status + Test mode badge, connect "Coming soon" until R5), `account/page.tsx` (name, email, phone, sign out, delete-account request as "Coming soon").
- `components/auth/signup-flow.tsx`: "or" divider + "Continue with Google" (reuses `signInWithGoogle`).

**Checks:** `pnpm lint && pnpm typecheck && pnpm test:unit`, DESIGN 19 checklist at 360 px and 1440 px, CLAUDE.md section 8 checklist. Founder runs the social-links migration and a manual username change test.

**Risks:** the type-scale change touches every screen (do it first, check auth pages too); the token rename is mechanical but wide; username change must keep the unique index as the only authority (no check-then-update).
