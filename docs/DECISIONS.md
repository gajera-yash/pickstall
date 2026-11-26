# Decisions log

Short records of product and engineering decisions. Newest first. Each entry: date, decision, why, consequences. Do not edit past entries; add a new one that supersedes them.

---

## D-133: Google Search Console and Google Analytics 4 (with consent) for pickstall.store
- **Date:** 2026-11-26
- **Done in Google (founder's Chrome, founder's request):**
  - Search Console: the `pickstall.store` domain property was already verified and `https://www.pickstall.store/sitemap.xml` already read (23 pages). The home page is on Google; a fresh crawl was requested.
  - Google Analytics 4: account "Pickstall", property "pickstall.store" (India time, US dollar), web stream "Pickstall website", measurement id `G-FGVW6Y34SQ`. Optional data sharing (modelling, technical support, recommendations) and marketing emails turned off. The founder approved accepting the Analytics Terms; the Data Processing Terms (GDPR) were accepted too.
  - GA4 is linked to the Search Console property, so search queries show in Analytics.
- **Decision (founder chose GA4 with consent, 2026-11-26):**
  - **Where:** only Pickstall's own home, sign-up, sign-in and legal pages (`TRACKED_PATHS`). Never dashboards, the admin, buyers' libraries, checkouts or creators' stores (creators have their own pixels, D-097).
  - **When:** only after the visitor clicks "Accept". The cookie notice is now a choice with equal "Decline" and "Accept" buttons (when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set; otherwise it stays the plain notice). The choice is kept in local storage; the Cookie Policy shows it and lets the visitor change it; declining later stops GA storage on the page.
  - **How:** `PlatformAnalytics` loads gtag.js with Consent Mode (analytics allowed; ad storage, ad user data and ad personalisation denied; Google signals off). The page CSP allows `www.googletagmanager.com`, `*.google-analytics.com` and `*.analytics.google.com`.
  - **Policies:** the Cookie Policy gains an "Analytics" section (`_ga`, `_ga_<id>`, up to 2 years) and the Privacy Policy lists Google Analytics.
  - **Setup:** new public env `NEXT_PUBLIC_GA_MEASUREMENT_ID` (set it to `G-FGVW6Y34SQ` in Vercel).

## D-132: Browser push notifications for creators
- **Date:** 2026-11-26
- **Why:** notifications only showed in the bell (and as a pop-up while a dashboard tab was open), so creators missed sales.
- **Decision (founder chose real push with the `web-push` package, VAPID keys and a new collection, 2026-11-26):**
  - **Turn on** from the bell: "Get a notification on this device for every sale, even when Pickstall is closed". The browser asks for permission, registers `/push-sw.js` (shows notifications and opens the dashboard page they point to; caches nothing), subscribes with `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, and the subscription is saved for the session's user and store (`savePushSubscriptionAction`, rate limited). "Turn off" unsubscribes and deletes it.
  - **Sending:** every new in-app notification (`notify`: sales, refunds, lesson videos) is also pushed to the store's browsers (`sendPushToStore`, `web-push` with VAPID details per call, 4 s timeout, at most 10 browsers per store). A replayed event (duplicate notification) sends no second push. A browser the push service reports gone (404/410) is removed. A push problem never breaks a sale.
  - **Privacy:** the payload is only the notification's title, body and a dashboard path (checked to start with `/dashboard`); never buyer emails. With push on, the tab's own pop-ups are skipped so nothing shows twice.
  - **Data and setup:** new collection `pushSubscriptions` (`_id` = SHA-256 of the endpoint; indexes on store and user; deleted with the account). New env `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, made with `pnpm push:keys`. Without them the switch stays hidden and nothing is sent. New dependency `web-push` (and `@types/web-push`).
- **Limits:** iPhone and iPad get web push only for a site added to the Home Screen (needs the PWA manifest, a later block). Desktop Chrome, Edge, Firefox and Android work in the browser.

## D-131: AI writing helper for creators
- **Date:** 2026-11-26
- **Decision (founder picked the AI writer, 2026-11-26):**
  - **"Write with AI"** under product and course descriptions, and next to the email templates of all five creator emails (confirmation, welcome, broadcast, abandoned cart, review request). The creator may add what it should say and pick a tone (friendly, professional, short, excited); the draft replaces the text in the field for them to read and edit. Nothing is saved until they save.
  - **Model:** Groq with the existing `GROQ_API_KEY` (`GROQ_MODEL` optional), strict JSON output, plain fetch (`lib/ai/groq-text.ts`). Without a key the button answers "The AI writer isn't turned on yet."
  - **Rules** (`lib/ai/creator-writer.ts`): only the creator's own words are sent (title, notes, current text), never buyer data. The prompt forbids invented facts, prices, discounts, guarantees, testimonials and deadlines, and asking readers for passwords or card numbers. The answer is cleaned of HTML, cut to each field's limit, and any placeholder the email cannot use is removed.
  - **Limits:** 20 per creator per hour and 60 per store per day (`writeWithAiAction`).
  - No data change.

## D-130: Store templates (Phase 5, template library)
- **Date:** 2026-11-26
- **Decision (founder picked the template library, 2026-11-26):**
  - **8 templates** (`lib/store-templates/catalog.ts`): Coach, Fitness, Course creator, Artist, Minimal, Creator, Wellness and Writer. Each is a theme, an accent, a custom design (D-123) and optional sample sections (D-101: an intro, a quote, links) with text the creator edits. Products always come from the store.
  - **Templates tab** first on Store design (`TemplatePicker`); a store with no design of its own opens on it. "Use this template" restarts the Theme, Customize and Sections tabs from the template (remounted with the template as their start and the real saved design as their baseline), so the preview shows it at once and Save lights up. Nothing is saved until Save; "Undo" puts the previous design back.
  - **Sample sections** are used only when ticked. Ticked by default for a store without sections; a store that has its own sections keeps them unless the creator ticks it (it says it replaces them).
  - **Safety:** templates go through the same save actions and checks as a hand-made design. Tests run every template through `accentSchema`, `storeDesignInput`, `designContrastProblem` and `pageBlocksInput`.
  - No data change: a template only fills fields that already exist.
- **Not in this block:** creator-made templates, sharing templates, template previews with real products before applying (the live preview shows them after applying).

## D-129: Marketing redesign: an overview of cards, and one page per tool
- **Date:** 2026-11-25
- **Decision (founder: "everything on one page will confuse creators", plan approved 2026-11-25):**
  - **Overview** (`/dashboard/marketing`): no forms. Four groups of cards (Discounts and offers, Email marketing, Automations, Grow and track); each card says what the tool does, shows its status now (for example "3 active codes", "On · 4 sent, 1 bought", "Meta and Google") and opens the tool's own page. Pro tools show a Pro badge. Status comes from `marketingOverview` (`lib/marketing/overview.ts`), read for the session's store; a part that cannot be read shows "Open to see".
  - **Own pages:** Coupons (`/coupons`), Offers (`/offers`: what bumps, upsells and downsells are, and which products have one, with links to each editor), Email design (`/emails`), Automations (`/automations`: welcome email, abandoned cart and review request in three tabs; the welcome email moved here from Email list), Pixels (`/pixels`). Email list, Broadcasts, Affiliates and Funnels stay where they were.
  - **Sub-nav** on every marketing page (`MarketingNav`, `MARKETING_SECTIONS`), scrolling sideways on phones; it replaces the "← Marketing" links. The breadcrumb shows "Marketing / <tool>".
  - **Saving** any marketing tool now refreshes every marketing page (`revalidatePath("/dashboard/marketing", "layout")`), so the overview's status is never stale.
  - **Tour and dots:** the Marketing tour now walks the overview cards; the "New" dots sit on the cards.
  - No change to data, validation or save actions.

## D-128: Click feedback, guided tours, "New" dots and help tips (speed S4-S5, tour T1-T3)
- **Date:** 2026-11-25
- **Decision (founder approved the plan; tours remembered per user in the database, 2026-11-25):**
  - **Click feedback:** sidebar links show a small spinner, and bottom-bar icons turn into one, while the page they open is loading (`LinkPending`, `PendingIcon`, built on `useLinkStatus`). A slow page no longer looks like a click that did nothing.
  - **Tour engine** (`components/tours/tour-provider.tsx`, no new dependency): coach marks that point at elements with `data-tour`, a spotlight on the element, a small card next to it (docked at the bottom on phones), Next/Back/Skip, Esc and arrow keys, focus on the main button, reduced motion respected. A step whose element is not on screen is skipped.
  - **Tours** (`lib/tours/catalog.ts`): welcome (6 steps over the sidebar, on My Store), Store design, product editor, Marketing, Orders and Analytics. Each starts once, the first time the page opens, and only after setup is done (the checklist guides before that).
  - **"New" dots:** Store design (sidebar), Email design, Review request, Affiliates and Funnels. Click explains the feature; "Got it" hides it for good.
  - **Help tips:** a "?" with a short explanation on the accent color, the email variables and how lessons open (drip).
  - **"Take the tour again"** on My Store's help card forgets the tours (not the dots) and starts the welcome tour.
  - **Data:** new collection `tourProgress` (`_id` = user id, `seen` ids), read and written only for the session's user, only known ids; removed with the account. No migration.
- **Not in this block:** S3 (fewer queries per page) beyond D-127's region move; tour analytics (PostHog is not wired in yet).

## D-127: Faster pages: indexes once per version, and functions in Mumbai (speed block S1-S2)
- **Date:** 2026-11-25
- **Measured on the live site:** cold pages took 7-10 s (Store design 10.2 s, Products 7.2 s), warm ones about 0.9 s. Vercel served from Mumbai but ran the functions in Washington (`bom1::iad1`), while MongoDB Atlas is in AWS Mumbai (ap-south-1), so every query crossed the world.
- **Decision (founder approved the speed plan; Atlas region given 2026-11-25):**
  - **Indexes:** `getDb` no longer sends all ~80 `createIndex` commands on every new server instance. `ensureIndexesOnce` reads one `appMeta` document (`_id: "indexes"`); when its `version` matches `INDEX_VERSION` (a hash of `ensureIndexes`, so changing the index list changes it), nothing is built. Otherwise the indexes are built and the version is saved. A failed build saves nothing, so the next start tries again.
  - **Region:** `vercel.json` sets `"regions": ["bom1"]` (Mumbai), next to the database.
  - **Data:** new small collection `appMeta` (one document). No migration.
- **Consequence:** an index dropped by hand is not recreated until the index list changes; change the list (or delete the `appMeta` document) to rebuild.
- **Next:** S3 fewer queries per page, S4 stale screens after a click, S5 instant loading skeletons.

## D-126: Product import from Gumroad and from a CSV (Stan Store)
- **Date:** 2026-11-21
- **Decision (founder asked for "Gumroad/Stan thi product import"):**
  - **Gumroad:** the creator pastes an access token from their Gumroad application page (gumroad.com/api: "Generate access token"); we call `GET https://api.gumroad.com/v2/products` once for a preview and again on import (ids from the browser only pick). The token is never stored or logged.
  - **Stan Store:** has no product export or API (help.stan.store checked 2026-11-21), so creators upload a CSV (title, price, description; template on the page). Column mapping with a preview.
  - Imports are **drafts** of digital products: title, description (Gumroad HTML turned into text), price only when the source currency is the store currency, and for Gumroad the cover copied into our image storage (only from `*.gumroad.com` https hosts). Files can't be copied, so the creator adds the file or link and publishes. Memberships are shown but skipped.
  - `products.importedFrom` with the unique index `products_store_import_unique` (store, source, external id): importing again adds nothing twice. Up to 100 per import, within the store's product limit, rate limited.
- **Why:** founder request; PRD section 9 lists import.
- **Consequences:** a creator moving from Stan types or pastes their products into the CSV; descriptions lose Gumroad formatting (plain paragraphs).

## D-125: Store design gets its own page
- **Date:** 2026-11-23
- **Decision (founder: "My Store gets cluttered and confusing", plan approved 2026-11-23):**
  - **New page** `/dashboard/design` ("Store design", second in the sidebar; under "More" on the phone's bottom bar). The editor on the left in three tabs: **Theme** (themes and accent), **Customize** (D-123) and **Sections** (D-101, with D-123 styles). A large live preview on the right (Phone or Desktop) from 1024px; on smaller screens a "Preview" button opens it full screen.
  - **One Save button** in a sticky bar at the top saves every part that changed, one after the other, through the same server actions as before (`savePageDesign`, `saveStoreDesignAction`, `savePageBlocksAction`). Each editor registers its saver in the design draft (`useSaver`); an error shows in its own tab. "Unsaved changes" shows until saved, and leaving the page asks first. "Back to theme" in Customize now clears the design without saving; Save saves it.
  - **Live preview** now also shows page sections while they are edited (once complete enough to draw), not only after saving.
  - **My Store:** the Store design tab is gone; a "Store design" button sits next to "Add product", and the preview card's "Customize design", the top bar, the welcome card and the command menu link to the new page. An old `?tab=design` link redirects there. The preview data for both pages comes from `lib/dashboard/store-preview.ts`.
  - No change to validation, data or saving rules.
- **Not in this block:** drag and drop, undo/redo, new design options.

## D-124: Email designs and ready-made texts for every creator email (block E1)
- **Date:** 2026-11-23
- **Decision (founder approved the E1 plan with D1, 2026-11-23; available on every plan):**
  - **Five emails** a creator writes get the same two helpers: the order confirmation (each product), the welcome email, broadcasts, the abandoned cart reminder and the review request.
  - **Email design (look):** one per store, chosen on Marketing → Email design with a live preview (the real email HTML in a sandboxed frame): Simple (plain, like a note), Card (white card on a soft background), Bold (a strip in the accent color with the store name) and Minimal (small, centered). Buttons and links use the store's accent with a readable button text (`onAccentFor`); a bad accent falls back to the Pickstall blue. `lib/email/looks.ts` (`renderLook`) frames every email; the store name, the button (access, checkout or review link), the boxes for a booked call or a license key, and the footer (sender identity, why they get it, unsubscribe) are always added by the code, never by the creator.
  - **No look saved:** each email keeps its old look (Card for the order email, Simple for the others) in Pickstall blue.
  - **Ready-made texts:** "Start from a template" on each of the five editors with 3-4 texts (`lib/email/presets.ts`). Picking one fills the subject and message, which the creator can change; nothing is saved until they save. Each set uses only the variables its email allows, checked by tests against that email's own rules.
  - **Data:** `stores.emailLook` (optional). Saved by `saveEmailLookAction` (owner from the session, 30 per 10 minutes). Senders read `emailLook` and `theme.accent` with the store. No migration.
- **Not in this block:** per-email looks, images or logos in emails, and rich text in the message.

## D-123: Custom store design on top of the theme, and section styles (block D1)
- **Date:** 2026-11-23
- **Decision (founder approved the D1 plan, 2026-11-23; available on every plan):**
  - **Customize panel** on My Store → Page design, under Theme and color. Every choice is optional; "Theme" keeps the theme's own value:
    - Colors: background, text, secondary text, cards (accent stays in Theme and color).
    - Page background: theme, one color, a two-color gradient, or an image (dimmed with the background color at 82% so text stays readable).
    - Headline font from a fixed list (modern sans, classic serif, elegant serif, grotesk, round, mono; self-hosted with next/font, not preloaded) and weight.
    - Buttons: square, rounded or pill; filled or outline (outline uses the accent as text).
    - Cards: corners 0-24px, border none/thin/thick, shadow none/soft/hard.
    - Layout: any of the 7 layouts with any theme; products in a grid or one column (Stack layout).
    - Header: photo and name centered or on the left, an optional cover image above the page, social icons on or off.
    - "Back to theme" removes the whole design.
  - **Data:** `stores.theme.custom` (optional, `StoreDesign` in `lib/store-design/rules.ts`). Saving the theme now sets `theme.preset` and `theme.accent` as dotted fields, so the custom design stays. Page sections gain an optional `style` (`box` card/outline/none, `align` left/center, `spacing` compact/normal/roomy); only a non-default style is saved. No migration.
  - **Safety:** fixed options and #RRGGBB colors only, no CSS or HTML; images are uploads or https (`safeImageSrc`). The server checks everything again (`saveStoreDesignAction`, owner from the session, 60 per 10 minutes). Text and secondary text need 4.5:1 on the background, every gradient color and the cards; an outline button needs its accent at 4.5:1 on the cards. A saved design is checked again when read; if its colors no longer read well (for example after a theme change), the theme's colors and background are used and the rest stays.
  - **Preview:** the Store preview shows every valid change before saving (the design draft now carries `custom`).
- **Not in this block:** drag and drop, columns, separate landing pages, custom CSS, the setup wizard's phone preview (theme and accent only).

## D-122: Daily growth report at 21:00 IST (marketing block M5)
- **Date:** 2026-11-23
- **Decision (founder approved the M5 plan, 2026-11-23):**
  - **When:** Inngest cron `TZ=Asia/Kolkata 0 21 * * *` (`lib/marketing/report-job.ts`), plus "Send today's report now" on `/admin/growth/reports` (admin, 10 an hour). A report covers 21:00 IST of the day before to the moment it is built; a run within 15 minutes after 21:00 still covers the day that just ended (`reportWindow`). Its `_id` is the India date the window ends on.
  - **Content** (`buildDailyReport`, numbers from the database only, no AI): outreach (DMs, follow-ups, replies = moves to Replied / Interested / Call booked, closed, drafts by AI vs template, leads imported), creators (signups by source, stores first published, PayPal connected, first real sales and first paid plans in the window, same sale rules as D-119), who moved (up to 20: messaged, follow-up sent, stage moves, signed up through their link), the last 7 days (DMs, replies, signups), needs attention (follow-ups due, Replied for over a day, signed up in the last 14 days without a published store, drafts where the AI was not used) and up to 3 priorities by fixed rules (replies, follow-ups, stuck signups, new DMs or "import more"). Website visits (PostHog, M1b) and content (M7) are marked "not set up yet".
  - **Delivery:** emailed through `sendEmail` (Resend) to the new optional env `GROWTH_REPORT_EMAIL`; without it the report is only saved. Every run rebuilds and saves the report (collection `mktReports`). The 21:00 job claims the day's email by setting `emailedAt` first, so it goes once; a failed send releases the claim. "Send now" emails a "Preview so far" each time it is pressed and never touches `emailedAt`, so the 21:00 email still goes. Plain text plus inline-styled HTML, every value escaped; lead names or handles and counts only (no notes, no creator or buyer emails).
  - **Screens:** `/admin/growth/reports` (list, emailed or not) and `/admin/growth/reports/[day]` (same content as the email).
- **Why:** MARKETING_AGENTS_PLAN.md M5, the founder's end-of-day data.
- **Consequences:** the report needs Inngest connected in production (launch checklist A) and a verified Resend sender (`EMAIL_FROM`). "Send now" after 21:15 IST builds the next day's report so far; the 21:00 job completes it.

## D-121: DM drafts with Groq (template fallback), fit score, Today queue and follow-ups (marketing block M3)
- **Date:** 2026-11-23
- **Decision (founder approved the M3 plan, 2026-11-23; Groq now because the Claude API felt costly, switch to Claude later):**
  - **New external service: Groq** (not in CLAUDE.md's stack; founder's choice). Plain `fetch` to `POST https://api.groq.com/openai/v1/chat/completions` (no new dependency), model `openai/gpt-oss-120b` by default (`GROQ_MODEL`), strict `json_schema` output `{ firstMessage, followUp }`, `reasoning_effort: "low"`, 25 s timeout. Facts checked in Groq's docs on 2026-11-23 (models, API reference, structured outputs, your data). Groq does not keep request data by default; abuse logs up to 30 days unless Zero Data Retention is on (founder to turn it on). Its data page does not say whether it trains on API data.
  - **Writers** (`lib/marketing/ai/`): `MARKETING_AI_PROVIDER` = `template` (default, no AI) or `groq` (needs `GROQ_API_KEY`). Claude is added later as one more writer in `writer.ts`. Every AI draft goes through `draftProblem` (600 characters, no links, emails, placeholders or markup, no tax, guarantees, testimonials or card checkout, "0%" only with PayPal's fees); a broken or failed draft is tried once more, then the template is used with a note. A 429 or a refused key goes straight to the template. Facts a draft may state live in `lib/marketing/ai/facts.ts` (our prices from `lib/config.ts`; Stan $99 and Gumroad 10% + $0.50 as read on 2026-11-23, to re-check).
  - **What leaves our database:** first name, topic, store tool, a follower range (`followerBand`) and country. Never the handle, notes or exact follower count. Voice examples (the founder's own DMs) go in the system prompt.
  - **Fit score** (`leadFit`, no AI, not stored): store tool (Stan/Gumroad highest), 1K-50K followers, US/UK/Canada, a known topic; India gets a PayPal warning.
  - **Collections:** `mktDrafts` (draft history per lead: both messages, writer, model, note), `mktSettings` (one document: up to 4 voice examples, daily draft limit 30, daily contact target 15). `MktLeadDoc.followUpSentAt` (optional) and event types `followed_up`, `draft_written`. Deleting a lead deletes its drafts.
  - **Screens:** `/admin/growth/today` (best-fitting New leads up to the daily target minus those contacted today, with drafts, "Open profile", copy and "Mark sent"; follow-ups due 4 days after contact without a reply, one only; leads with no reply 4 days after the follow-up, offered "Mark not interested", nothing automatic), `/admin/growth/settings`, and a draft card with fit on the lead page. "Write drafts for N" writes one lead per request so a slow AI never times out a page.
  - **First DM carries no link** (cold DMs with links look like spam); the founder sends the lead's link from its page after a reply.
  - **Privacy Policy:** "Creators we contact" now names the AI service and the fields sent.
- **Why:** M3 of MARKETING_AGENTS_PLAN.md, at no cost to start.
- **Consequences:** the daily draft limit is checked before each draft, so two drafts written at the same moment can pass it by one. Groq's free-tier limits are only on the account's limits page; a 429 falls back to the template. Switching to Claude needs `@anthropic-ai/sdk` (founder approval) and one writer file.

## D-120: Outreach leads in Admin > Growth (marketing block M2)
- **Date:** 2026-11-23
- **Decision (founder approved the M2 plan, 2026-11-23; list of 500+ creators the founder built by hand, columns Name, Handle, Platform, Followers, Country, Course topic, Current tool, Contact Method, Status, Notes):**
  - **Collections:** `mktLeads` (unique `handleKey` = platform + lower-case handle; unique random 8-character `refCode`, never derived from the handle), `mktEvents` (imported, stage changed, contacted, notes changed; actor `admin:<username>`), `mktSuppressions` (`_id` = SHA-256 of `handleKey`, for deleted and "do not contact" leads). Index `stores_acquisition_ref` on `stores.acquisition.ref`. No migration.
  - **Import** (`/admin/growth/import`): the browser reads the CSV (2 MB, 5,000 rows, the D-100 parser, no new dependency), guesses the columns from the headers, and asks which stage each distinct Status word means (guessed, founder confirms). Parts of 1,000 rows go to `importLeadsAction`; the server cleans every row (`cleanLeadRow`: handle from `@`, a profile link or plain text; followers like "12.5K"; known tools, others kept as their label), counts rows without a valid handle with their file row numbers, skips handles already in the list or suppressed (`$setOnInsert` upserts), and records counts in the audit log.
  - **Stages** are set by the founder: New, Contacted, Replied, Interested, Call booked, Not interested, Do not contact. "Do not contact" also suppresses the handle; moving away from it lifts that. Signing up and later steps (store live, payments, first sale, paid plan) are never stored on the lead: `linkedStores` reads them from the store found by the lead's `?ref=` code (D-119) or, failing that, a store whose social links hold the same profile URL (exact, lower-case), with the D-119 step rules (`storeSteps`, shared with the funnel).
  - **Screens:** `/admin/growth` (counts, search, filters by stage incl. "Signed up", tool, topic, country; most followers first; 50 a page), `/admin/growth/[id]` (personal link with copy, profile link, stage, "Mark contacted today", notes, store progress, history, delete with confirmation), `/admin/growth/export` (CSV, formulas neutralized, audit-logged).
  - **Privacy Policy:** new "Creators we contact" line (public profile data, notes, deletion on "stop", one-way hash kept).
- **Why:** M3 (DM drafts) and M5 (daily report) need one place that knows every lead, their personal link, and whether they signed up.
- **Consequences:** the profile match misses a store whose saved profile URL differs in letter case from the lead's handle. The counts read every lead's code on each page load, fine for thousands of leads; revisit beyond that. DMs are still sent by hand from the founder's own account (MARKETING_AGENTS_PLAN.md section 0).

## D-119: Where creators sign up from, and the creator funnel (marketing block M1)
- **Date:** 2026-11-23
- **Decision (founder approved the M1 plan, 2026-11-23; see docs/MARKETING_AGENTS_PLAN.md):**
  - **Capture:** the landing page and `/signup` note the link's personal lead code (`?ref=`, 3-32 letters, digits or dashes; the latest wins) and its first UTM tags or referring site in `sessionStorage` key `ps_signup_source` (this tab only, no cookie, no id), like D-112. The signup form and the username step (after Google sign-in, which ignores its own referrer because it is Google) send them as hidden fields. Store pages keep using `?ref=` for creators' affiliates (D-113) under their own key; the two never mix.
  - **Server:** `acquisitionFrom` (`lib/marketing/acquisition.ts`) reuses the D-112 cleaning; a lead code alone counts as source `outreach`. Email signups keep it on the signup intent until the code is verified; both paths pass it to `createDraftStore`, which saves the new optional `StoreDoc.acquisition` (`ref`, `source`, `medium`, `campaign`, `referrer`). Admin-only: no public projection includes it.
  - **First publish:** new optional `StoreDoc.publishedAt`, set by `setStorePublished` on the first publish in the same update (`$ifNull`) and never cleared.
  - **Badge:** the "Powered by" logo on live store pages links to `/?utm_source=pickstall_store&utm_medium=badge&utm_campaign=<store slug>`; the dashboard preview keeps a plain `/` link. `Wordmark` got an optional `href`.
  - **Funnel:** `creatorFunnel(days)` (`lib/marketing/funnel.ts`) takes the stores created in the period and counts: published (`publishedAt`, or `isPublished` for older stores), payments connected (PayPal now or ever per the audit log, or Stripe charges on), first real sale (paid or refunded order above 0, not a bump, not the mock), paid plan (a plan payment above 0); totals and up to 20 sources (no source = `direct`). Shown on the admin Overview as "Creator funnel, 30 days".
- **Why:** the marketing agents (M2-M5) need to follow one outreach link to a signup, a sale and a plan, and the daily report needs the funnel from real data.
- **Consequences:** no migration; older stores count as `direct`. A creator who opens the link in one tab and signs up later in another is counted as direct (M2 will also match leads by email or username). Privacy Policy gained a "How you found us" line; the legal effective date was not changed (founder to decide). PostHog (website visits) is a separate block, M1b.

## D-118: Payments move from Stripe to PayPal (creators' sales and Pickstall plans)
- **Date:** 2026-11-21
- **Decision (founder, 2026-11-21: "use PayPal, not Stripe"; plan approved the same day):**
  - **Creators' sales:** each creator connects THEIR OWN PayPal REST app (Client ID and Secret pasted in Settings > Payments, or the setup step). We check the keys with PayPal, register our webhook `/api/webhooks/paypal/<storeId>` on their app, and store the Secret AES-256-GCM encrypted (`PAYMENT_CREDENTIALS_KEY`, the store id as AAD; `lib/security/secret-box.ts`, `stores.paypal`). Orders v2 are created with the creator's app, so the money goes straight to them: no payee override, no platform fee, Pickstall never holds funds. This is temporary until PayPal partner approval (Commerce Platform), which the founder has not applied for yet; only the connect step changes then.
  - **Flow:** `createCheckout` (intent CAPTURE, `custom_id` and `invoice_id` = our order id, `brand_name` = store name, NO_SHIPPING, PAY_NOW) -> buyer approves -> capture on the thank-you page, on `CHECKOUT.ORDER.APPROVED`, or by the Inngest sweep (all idempotent with `PayPal-Request-Id`). Only the verified `PAYMENT.CAPTURE.COMPLETED` webhook marks the order paid (same `process.ts` path, amount and currency checked). Refunds: full refund of the capture on the creator's app; `PAYMENT.CAPTURE.REFUNDED` / `REVERSED` change the order (full vs partial from the capture's status).
  - **Webhook trust:** every delivery is checked with PayPal's verify-webhook-signature API for the app and webhook id it was sent to; a creator event carries its store id and `fromStoreAccount` requires it to be the order's store (creator B's app cannot pay or refund creator A's order).
  - **Sweep:** `paypal-pending-sweep` (every 15 minutes) captures approved checkouts and fails abandoned or expired ones after 3 hours, freeing coupon uses and coaching times (PayPal sends no event for an abandoned checkout).
  - **Platform billing:** Pickstall plans on OUR OWN PayPal app (`PAYPAL_CLIENT_ID`): product `PICKSTALL-PLANS`, monthly USD plans created on first use and found by name ("Pickstall Starter monthly 1900 USD"); subscriptions carry the store id as `custom_id`; switching uses PayPal's revise (subscriber approves); cancel keeps access until the paid month ends; "Manage billing" opens PayPal's automatic payments page. Verified webhook `/api/webhooks/paypal` and the return route save only subscriptions fetched from PayPal for the right store; completed transactions become plan payments for the admin revenue.
  - **Currencies:** stores may pick only PayPal's currencies (`PAYPAL_CURRENCIES`): not INR, BRL, CNY, MYR, RUB, HUF or TWD. A store with another currency is told to change it.
  - **Stripe** stays in the code, switched off; `PAYMENT_PROVIDER=stripe` turns it back on. `CreatorStore.chargesEnabled` replaces `stripeChargesEnabled` for setup, publishing and checkout.
  - No SDK: a small `fetch` client with Zod-checked responses (`lib/payments/paypal-api.ts`). Shapes checked against PayPal's REST docs and OpenAPI files on 2026-11-21.
- **Why:** founder decision.
- **Consequences:**
  - PayPal India business accounts can only receive international payments, and Subscriptions do not support INR: Indian creators cannot sell to Indian buyers through PayPal, and plans are billed in USD.
  - Creators need a PayPal Business account and a few minutes on developer.paypal.com (step-by-step help on the page).
  - New env: `PAYMENT_PROVIDER`, `PAYPAL_MODE`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYMENT_CREDENTIALS_KEY` (docs/DEPLOY_VERCEL.md step 6). Sandbox until the founder approves live mode.
  - Not verified end to end against the PayPal sandbox yet: that needs the founder's sandbox apps and a deployed https URL.

## D-117: Stuck broadcasts fail on their own, and the "please review" email
- **Date:** 2026-11-20
- **Decision (founder approved the plan, including the schema fields and the paid-order hook, 2026-11-20):**
  - **Stuck broadcasts:** an Inngest cron (`broadcasts-fail-stuck`, every 15 minutes, UTC) runs `failStuckBroadcasts`: a broadcast still "sending" whose `updatedAt` is more than 1 hour old is marked "failed" (with `finishedAt`). A live broadcast moves `updatedAt` on every batch of 100, so it is never caught. New index `broadcasts_status_updated`.
  - **Review request:** one email a week after each paid order, asking the buyer to rate the product. The button opens `/library/{orderId}`, where the review form already is (D-106). Settings on Marketing next to the abandoned cart card: on/off (default off), optional subject and message with only `{{customer_name}}` and `{{product_title}}`; the review button, the store name and the "only review request" line are always added. An automation (D-098): saving it on needs the plan.
  - **When it is not sent:** the order is no longer paid (refunded), is a bump, or was already asked; the store has it off, is suspended, cannot sell or has no automations; the product was deleted; the buyer already reviewed the product or unsubscribed from the store.
  - **Sent once:** `onOrderPaid` queues an Inngest event with id `review-request-<orderId>` (a replay queues nothing new; never throws). After `step.sleepUntil(paidAt + 7 days)` the job claims `orders.reviewRequestSentAt` before sending, and the Resend idempotency key is `review-<orderId>`.
  - **Data:** `StoreDoc.reviewRequest?` and `OrderDoc.reviewRequestSentAt?`, both optional; no migration.
- **Not in this block:** a creator-chosen delay, requests for orders paid before the setting was on, and sending without Inngest (development).

## D-116: Admin update A3: full screen, platform billing and revenue, analytics, audit log, exports
- **Date:** 2026-11-20
- **Decision (founder approved the A3 plan, including the platform billing webhook change, 2026-11-20):**
  - **Full screen:** the admin no longer sits in a 7xl container. A full-height sidebar (sections, the signed-in admin, Sign out) and the content across the rest of the screen; phones and tablets get a menu button with the same sections in a sheet. New sections: Billing and Audit log.
  - **Plan payments:** a verified `invoice.paid` event on the platform endpoint now also carries the invoice id (`billing.subscription` with `invoiceId`). After the usual subscription sync, `recordPlanInvoice` fetches the invoice from Stripe (never trusting the body) and saves it in the new `planPayments` collection, `_id` = invoice id, so replays and the import never save one twice. The store comes from the subscription metadata on the invoice, else from `stores.billing.customerId`. Creator sales (Connect) are untouched; no application fees or transfers.
  - **Real MRR:** the subscription sync now also saves Stripe's price on `stores.billing` (`amountCents`, `currency`, `interval`). MRR = active and past-due subscriptions per month (yearly divided by 12); rows from before this fall back to the planned price. ARR = MRR × 12.
  - **Billing page** (`/admin/billing`): MRR, ARR, active plans by tier, new paying creators this month (first plan payment), cancellations in 30 days, revenue this month and all time, 12-month revenue chart (USD), payment problems (past due or unpaid), the latest 25 plan payments, and "Import past invoices from Stripe" (`importPlanInvoicesAction`: admin only, 3 per 10 minutes, reads up to 2,000 paid invoices, audited as `admin.billing_imported`).
  - **Overview:** MRR from real prices and revenue this month, the share of ended trials now on a paid plan, and 30-day charts of new creators and paid creator orders (`AdminBarChart`, server-rendered SVG with a screen-reader table).
  - **Creator page:** plan payment history and a link to the store's audit log.
  - **Audit log page** (`/admin/audit`): every audit record across the platform, newest first, 50 a page, filter by action or store; actors show as "admin: name", "creator" or "system" (no user ids or emails). New indexes `audit_action_at` and `audit_store_at`. Audit labels moved to `lib/audit/labels.ts`.
  - **CSV exports:** `/admin/creators/export` and `/admin/billing/export` (admins only, otherwise 404; 20 per 10 minutes; at most 5,000 rows; formulas neutralized).
  - **Data:** new collection `planPayments` (indexes `plan_payments_paid`, `plan_payments_store_paid`); `StoreBilling` gains optional `amountCents`, `currency`, `interval`. No migration: the import button fills past payments.
- **Not in this block:** plan refunds and credit notes in revenue, revenue in currencies other than USD on the chart, and churn by cohort.

## D-115: Funnels: downsell and funnel numbers (Phase 4, block P4-6)
- **Date:** 2026-11-20
- **Decision (founder approved the plan, 2026-11-20):** the funnel is the existing path (product page, checkout, order bump, upsell, thank-you) plus:
  - **Downsell:** under "Upsell after purchase", every product editor (digital, course, coaching) has "Downsell if they say no": another digital product or course of the store (or the same one as the upsell, for less), a price and an optional headline. Saved with `saveUpsellAction(productId, input, "downsell")` in `ProductDoc.downsell`, with the upsell's rules (D-099). Pro, like upsells.
  - **Thank-you page:** `PostPurchaseOffers` shows the upsell; "No thanks" shows the downsell instead (or nothing). `startUpsellCheckout(..., "downsell")` reads the offer again on the server (`findUpsellOffer(..., "downsell")`), takes the price from the database and opens a fresh checkout; there is still no one-click charge.
  - **One offer per order:** once an upsell or downsell order of a purchase is paid, neither is offered again for it.
  - **Order:** offer orders now save `offer: "upsell" | "downsell"` next to `upsellOf`; older upsell orders without it count as upsells. No migration.
  - **Funnels page** (`/dashboard/marketing/funnels`, linked from Marketing): for each product with an offer set up (or offer sales in the period), the paid sales, upsells taken and downsells taken (count and share of sales), and offer revenue, over 30 or 90 days, net of partial refunds. Only the session's store.
- **Not in this block:** counting how many buyers saw each offer, more than two offer steps, and a visual funnel builder.

## D-114: License keys (Phase 4, block P4-5)
- **Date:** 2026-11-20
- **Decision (founder approved the plan, including the change to the payment fulfilment path, 2026-11-20):**
  - **Creators** switch "License key" on in a digital product's Checkout form step (`saveProductLicenseAction`, `ProductDoc.license.enabled`). Lead magnets, courses and coaching calls have no keys.
  - **Issuing:** `onOrderPaid` (the verified payment path, and free orders through `markFreeOrderPaid`) calls `issueLicenseForOrder` before the confirmation email, for the order and for a bump order. A paid order of a product with keys on gets one key: 20 random characters from Crockford's base32 in four groups (100 bits). The unique index on `orderId` makes a replayed webhook harmless. A failure is only logged; the sale and the email go through. Prices and the Stripe calls do not change.
  - **Buyers** see the key on their library purchase page (with Copy), and the confirmation email always includes it, whatever the creator wrote (like the access link).
  - **Valid** while the order is paid and the creator has not revoked it. A full refund makes it invalid (no extra write: the order status decides). Creators revoke or restore a key in the order details.
  - **Verify API:** `POST /api/licenses/verify` with JSON `{"store": "<username>", "key": "..."}` answers `{"valid": true, "product": "<title>"}` or `{"valid": false, "reason": "not_found" | "revoked" | "refunded"}`. Typing slips are accepted (lower case, spaces, missing dashes, I/L/O). Any origin may call it (CORS `*`, no cookies, `no-store`); 60 tries per 10 minutes per network address; at most 1,000 bytes. Nothing about the buyer is returned.
  - **Data:** new collection `licenseKeys` with unique indexes `license_keys_order_unique` and `license_keys_store_key_unique`.
- **Not in this block:** uploading the creator's own key list, activation limits per device, and keys for courses.

## D-113: Affiliate tracking (Phase 4, block P4-4)
- **Date:** 2026-11-20
- **Decision (founder approved the plan, 2026-11-20; available on every plan):**
  - **Tracking only** (PRD hard constraint: affiliate payouts cannot be automated). The platform never pays affiliates, holds money or moves funds. Creators pay affiliates themselves and record it.
  - **Creators** manage affiliates at Marketing → Affiliates (`/dashboard/marketing/affiliates`): name, optional email (for their records, never emailed), code (3-20 lower-case letters, numbers or dashes, unique per store) and a commission of 1-90%. Up to 50 per store. Each can be paused (their link stops counting) or resumed.
  - **Link:** any store or product link plus `?ref=code`. Like attribution (D-112), the code is noted in `sessionStorage` for that browser tab only (the latest code wins, no cookie) and sent with the checkout form. `startCheckout` keeps it only when it is an active affiliate of the store being bought from, and freezes the rate on the order: `OrderDoc.affiliate` (`affiliateId`, `code`, `commissionPercent`). Prices are not affected. An upsell order copies its parent's affiliate.
  - **Numbers per affiliate:** paid orders (bump orders left out), sales net of partial refunds (a full refund is not "paid"), commission at each order's frozen rate rounded down per order, recorded payments, and what is still owed.
  - **Recording a payment:** an amount in the store's currency (above 0) and an optional note, stored in `affiliatePayouts`. It changes only the totals.
  - **Data:** new collections `affiliates` (index `affiliates_store_code_unique`) and `affiliatePayouts` (index `affiliate_payouts_store_affiliate`), and an order index `orders_store_affiliate`. Every read and write filters by the session's store.
- **Not in this block:** a page for affiliates to see their own stats, affiliate sign-up, editing an affiliate's rate (add a new code instead), self-referral checks, and deleting a recorded payment.

## D-112: Where sales come from (Phase 4, block P4-3: attribution)
- **Date:** 2026-11-20
- **Decision (founder approved the Phase 4 order and this plan, 2026-11-20):**
  - **Capture:** the first store page of a browser tab (store page or product page) notes the link's `utm_source`, `utm_medium`, `utm_campaign` and the referring site's host in `sessionStorage` (this tab only, removed when it closes; no cookie, no id). Moving between our own pages is not a source. The checkout form sends them as four hidden fields.
  - **Server:** `attributionFrom` (`lib/analytics/attribution.ts`) cleans each label (tags removed, lower case, 100 characters) and keeps only a host name for the referrer. The UTM source wins; otherwise the referring site gives the source, with known sites merged ("l.instagram.com" is "instagram", "t.co" is "x"). Our own domain, junk and empty values mean a direct visit (nothing saved).
  - **Order:** new optional field `OrderDoc.attribution` (`source`, `medium`, `campaign`, `referrer`), set when the pending order is created. Prices, the provider call and fulfilment do not change. An upsell order copies its parent order's attribution. No migration: older orders count as direct.
  - **Dashboard:** Analytics shows "Where sales come from": paid orders above 0 in the last 30 or 90 days by source (orders, revenue net of partial refunds, share of orders, top campaign), up to 20 sources, plus a tip on adding UTM tags to links. Bump orders and free orders are left out. The placeholder "No traffic yet" card is gone.
- **Privacy:** only campaign labels and a site name are kept, nothing about the buyer. Visits from apps that send no referrer (often Instagram's in-app browser) count as direct unless the link has UTM tags.
- **Not in this block:** page view counts and conversion rates, and attribution of free sign-ups (lead magnets).

## D-111: Course certificates (Phase 4, block 2, part Q2)
- **Date:** 2026-11-20
- **Decision (founder approved the quizzes and certificates plan, 2026-11-20; available on every plan):**
  - **Creators** switch "Certificate" on in the course's Publish step (`saveCourseCertificate`, `ProductDoc.course.certificate`, missing = off). Turning it off later does not remove certificates already issued.
  - **Students** see a Certificate card under the lesson list. It unlocks when every lesson of the course is complete (quiz lessons complete only when passed, D-110). They confirm the name to print, filled in from the checkout name; it is cleaned of tags, 2-80 characters, and cannot be changed after issuing. `claimCertificate` checks access like the other student actions (own email, paid, not refunded or expired), that certificates are on, and that the course is finished. 10 claims per 10 minutes.
  - **One per order:** new collection `certificates` with a unique index `certificates_order_unique` on `orderId`; a second or racing claim returns the certificate already issued. The student name, course title and store name are copied in when it is issued.
  - **Public page** `/certificates/<uuid>`: name, course, store, issue date and the certificate id, plus "Print or save as PDF" through the browser (no PDF library). No email or order details, `noindex`, and "revoked" once the order is refunded. `certificates` is now a reserved store slug.
- **Privacy:** anyone with the link sees the printed name; the form says so. The link is a random UUID and is never listed anywhere public.
- **Not in this block:** a certificate email, creator logos or signatures on the certificate, and a creator list of issued certificates.

## D-110: Lesson quizzes (Phase 4, block 2, part Q1)
- **Date:** 2026-11-20
- **Decision (founder approved the quizzes and certificates plan, 2026-11-20; available on every plan):**
  - **Creators** add an optional quiz in the lesson sheet: 1-10 single-choice questions, 2-5 options each (different from each other), one right option picked with a radio button, and a pass mark of 50-100% (default 70%). Text is cleaned of tags (question 300, option 150 characters). It is saved with the lesson (`saveCourseLesson`, field `quiz`: null removes it, left out keeps it). A quiz counts as lesson content for the publish rule.
  - **Students** answer it under the lesson. `submitLessonQuiz` checks access like "Mark as complete" (paid, own email, not refunded or expired, lesson open), grades on the server from the lesson's own answers, and answers with the score and which questions were right, never the right options. Students only ever get `StudentQuiz` (no answers). Unlimited retries, 30 tries per 10 minutes.
  - **Completion:** a lesson with a quiz completes when the quiz is passed (passing marks it complete); "Mark as complete" is refused until then. Unmarking still works. Lessons completed before a quiz was added stay complete.
  - **Data:** `LessonDoc.quiz` (optional, missing on older lessons) and a new collection `quizAttempts`, one document per order and lesson (`_id` "orderId:lessonId", index `quiz_attempts_order`) with attempts, last and best percent and the first pass date. Answers are not stored.
  - The creator's preview shows the questions and the pass mark, without answering.
- **Next (Q2):** certificates when a course is finished (D-111).

## D-109: Admin username and password in the environment, sessions stay in the database (supersedes the accounts part of D-108)
- **Date:** 2026-11-20
- **Decision:** The founder wants the admin sign-in set in Vercel, not in the database.
  - **Credentials:** `ADMIN_USERNAME` and `ADMIN_PASSWORD` (at least 12 characters), server-only env variables. The username is matched case-insensitively; both are compared in constant time through their SHA-256. With either missing, `/admin/login` says sign-in is not set up and nobody gets in.
  - **Sessions:** unchanged from D-108 (`adminSessions`, token hash as `_id`, 8 hours, TTL index, httpOnly strict cookie `ps_admin`, sign-out deletes the row). Each session also stores a 32-character fingerprint of the credentials it was made with; changing the username or password in Vercel ends every admin session.
  - **Removed:** the `adminUsers` collection type and its index, `scripts/admin-create.mjs`, and the in-app password change. The Account page now explains where the credentials live.
- **Why:** One place to manage the admin sign-in, no setup script to run, and a quick way to sign everyone out (change the password and redeploy).
- **Consequences:** The password exists in plain form in Vercel env, so access to the Vercel project is access to the admin. Any old `adminUsers` documents in MongoDB are unused; they were left in place (collections are never dropped). Rate limiting (5 tries per 15 minutes per network address) and audit logging stay as in D-108.

## D-108: Admin accounts and sessions in the database (supersedes the env part of D-107)
- **Date:** 2026-11-20
- **Decision (founder, 2026-11-20):** the admin username, password and sessions are kept in MongoDB, not in environment variables.
  - **`adminUsers`:** username, `usernameKey` (unique, lower case), scrypt `passwordHash` (never the password), created and changed dates, and last sign-in. The first admin is made by the founder with `node --env-file=.env.local scripts/admin-create.mjs`. The password is asked for without showing it and typed twice; `--reset` sets a new password and signs out that admin's sessions.
  - **`adminSessions`:** `_id` = SHA-256 of a random 32-byte token (the cookie holds the token, the database only its hash), admin id, IP hash, created and expiry dates (8 hours). The TTL index `admin_sessions_ttl` removes old ones.
  - **Flow:** `/admin` without a live session redirects to `/admin/login`. A correct username and password create a session and an httpOnly, Secure (production), SameSite=Strict cookie, then open the dashboard.
    - **Sign out** deletes the session from the database, so the cookie stops working everywhere.
    - **Admin → Account** changes the password (current password required, 12+ characters) and signs out the admin's other sessions.
  - **Protection:** as in D-107, 5 tries per network address per 15 minutes and one answer for any wrong username or password. An unknown username still runs one scrypt check, so timing does not reveal it. Sign-ins, failures (no username kept), sign-outs and password changes go to the audit log.
  - `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` are removed, together with `scripts/admin-password-hash.mjs`.

## D-107: Admin sign-in with a username and password (replaces ADMIN_EMAILS; storage moved to the database in D-108)
- **Date:** 2026-11-20
- **Decision (founder approved the plan, 2026-11-20):**
  - The admin area has its own sign-in at **`/admin/login`** (username and password), apart from creator accounts. Without an admin session, every admin page redirects there. Signed-in admins see their username and a **Sign out** button.
  - **Password:** stored only as a scrypt hash (Node's built-in `crypto`, no new dependency) in `ADMIN_PASSWORD_HASH`. The founder makes it locally with `node scripts/admin-password-hash.mjs`, which asks for the password without showing it (12+ characters, typed twice) and also prints a fresh `ADMIN_SESSION_SECRET`.
  - **Session:** an httpOnly, Secure (production), SameSite=Strict cookie `ps_admin` holding `{ username, expiry }` with an HMAC-SHA256 signature (`ADMIN_SESSION_SECRET`). It lasts 8 hours, and the username must still equal `ADMIN_USERNAME`. Changing the secret or the username signs every admin out.
  - **Abuse protection:**
    - 5 tries per network address per 15 minutes.
    - Username and password are both checked every time, in constant time, with one answer: "Wrong username or password."
    - Every sign-in, failure (no username stored) and sign-out goes to the audit log.
    - Admin actions (D-105) record the actor as `admin:<username>`.
  - **Env:** `ADMIN_EMAILS` is removed. The new variables are `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET`. Without all three, admin sign-in is closed.
  - The admin pages moved into the route group `app/admin/(panel)`, so `/admin/login` sits outside the gated shell. The URLs are unchanged.
- **Later (optional):** a second step with an authenticator app.

## D-106: Product reviews (Phase 4, block 1)
- **Date:** 2026-11-20
- **Decision (founder: reviews show at once, no approval, 2026-11-20):**
  - **Buyers** rate a product from their library ("Rate this product": 1-5 stars as an accessible radio group, plus optional text up to 1,000 characters, cleaned of tags and links).
    - Only for their own **paid** order: the signed-in email must match the order, and a refund removes the form.
    - One review per buyer and product (`reviews_store_product_buyer_unique`). Saving again updates it, and a review the creator hid stays hidden.
  - **Public:** the product page shows the average, the count and the latest 20 published reviews. The name is shown only as first name and last initial ("Asha P."), never the email. Store cards show "★ 4.8 (23)".
    - Reads live in `lib/reviews/public.ts` (published only); `PublicProduct.rating` holds the summary.
  - **Creators:** a new **Reviews** section (sidebar, after Customers) with the average and every review, each with Hide / Show or Delete (with confirmation). Only the session's store.
  - New collection `reviews`, with indexes `reviews_store_product_buyer_unique`, `reviews_store_product_status` and `reviews_store_created`.
- **Not in this block:** a "please review" email after purchase, and creator replies.

## D-105: Platform admin, part A2 (actions)
- **Date:** 2026-11-20
- **Decision (founder approved the admin plan, 2026-11-19):** on a creator's admin page, `runAdminAction` (`lib/admin/actions.ts`) offers the actions below. Each one goes through `requireAdmin()` (404 for anyone else), Zod-checked input, a rate limit, a confirmation dialog with a required reason (cleaned, up to 200 characters), and an audit record (`admin.*` actions: admin id, store id, reason, hashed IP; no emails).
  - **Extend trial** by 7-90 days, from today or the current end, whichever is later.
  - **Grant founding** for 1-12 months (Pro for free).
  - **Suspend or restore a store:** `stores.suspendedAt` and `suspendReason`. `storeAccess` returns the new state `suspended`, which wins over any plan, so `can()` blocks selling, publishing, pixels and Pro features. The public store looks missing (404). The creator sees a "suspended" banner and plan status, and publishing explains why (`cannotPublishMessage`). Orders, buyers' libraries and data stay as they are.
  - **Block or allow broadcasts:** `stores.broadcastsBlocked`. It stops new broadcasts (`broadcastProblem`), stops a running one at its next batch, and stops welcome emails.
  - **Unpublish a product** back to draft. Buyers keep access.
- **Not done (by design):** no refunds or money movement, no card data, no logging in as a user, no deleting. Data export or deletion requests still go through the person's own account page.
- **Also:** `RemovableRow` (QA fix) no longer uses `any`, so `pnpm lint` passes again.

## D-104: Platform admin, part A1 (read-only)
- **Date:** 2026-11-20
- **Decision (founder approved the plan, 2026-11-19):**
  - **Access:** `/admin` is open only to signed-in users whose email is in `ADMIN_EMAILS` (server-only, comma-separated). The whole admin shell renders only after `requireAdmin()`, so anyone else gets the 404 page and never sees the navigation, and each page checks again.
  - **Pages, all read-only:**
    - **Overview:** creators, signups (7 and 30 days), live stores, paid plans and MRR at planned prices, trials (and those ending within 7 days), founding, paused, subscribed emails, broadcasts, orders and creator sales by currency.
    - **Creators:** every store, searchable by name, username or the owner's exact email, with plan, live status and Stripe. A detail page shows products, latest orders, sales, list health and broadcasts.
    - **Orders:** across stores, by order id, the buyer's exact email or product title.
    - **Products:** across stores, by title.
    - **Emails:** broadcasts, sends, failures, and stores with spam complaints or bounces.
    - **Health:** webhooks handled in 24 hours, stuck broadcasts, unfinished uploads, unpaid checkouts, database and image storage, and the latest audit log.
  - Queries live in `lib/admin/queries.ts`, read across stores on purpose and are only called after `requireAdmin()`. Owners' emails are read (never written) from Better Auth's `user` collection.
  - **Privacy Policy:** says that a small number of staff can see account, store and order details in admin tools, only to run the platform.
- **Next (A2, not built):** actions with confirmation and an audit log: extend a trial or grant founding, suspend or restore a store, unpublish a product, block broadcasts, and data requests. No refunds or money movement, no card data, no logging in as a user.
- **Setup:** set `ADMIN_EMAILS` in Vercel (for example the founder's sign-in email), then open `/admin`.

## D-103: Plan features listed, one dropdown design, a new products table, selling tools explained
- **Date:** 2026-11-19
- **Decision (founder request, 2026-11-19):**
  - **Plan page:** each plan card lists what it includes, grouped (Sell, Grow, Your store), with a check or a cross. The list is built from `PLAN_LIMITS` in `lib/plans/catalog.ts`, so it always matches what is enforced (D-098).
  - **One dropdown design:** a new `ChoiceSelect` (`components/ui/choice-select.tsx`, Radix Select from the existing `radix-ui` package, so no new dependency) replaces every native `<select>`. Its list looks exactly like the profile menu (DropdownMenu: surface, 1px border, radius lg, popover shadow, 40px rows, `--accent` highlight), and its trigger looks like our text fields.
    - Used in: coaching settings, course category, order bump and upsell product, checkout questions (editor, preview and the buyer's checkout), the import column pickers and the list filters.
    - The empty choice maps to an internal value. Named selects submit a hidden input with the real value.
  - **Products table:**
    - Newest first (`listProducts` sorts by `createdAt` descending), so a new product is at the top.
    - On desktop, a real table: product (cover, title, type), status, price, sales, revenue and date added. Sales come from `salesByProduct` (paid orders, not bump orders). The whole row opens the editor, and "..." holds the actions. On phones, cards.
    - The shared `Table` gets small uppercase headers and 64px rows, so every table looks the same.
  - **Selling tools explained:** a closed-by-default "How does this work?" (`HowItWorks`) with numbered steps and an example sits in the Order bump and Upsell sections of the editors and on the Marketing page, which also gains an "Upsell after purchase" card.

## D-102: Fixes from the QA sheet (setup, product editor, store details)
- **Date:** 2026-11-19
- **Decision:**
  - **Setup "Add your first product"** counts only a product that has been named. An untouched "Untitled product" draft does not count (a store that is already live keeps counting it, so it is never locked again). From the wizard, "Create a digital product" opens the newest untouched empty draft again instead of making another one (`findEmptyDraft`). Create buttons show a spinner and cannot be clicked twice (`PendingSubmit`).
  - **Publishing a product while setup is open** returns to `/dashboard/setup?published=1`, which shows "Product published", never the locked products list.
  - **Session expired during a signed-in action:** `requireCreatorForAction(returnTo)` sends the creator to `/login?next=...&error=expired`; the login page says "Your session expired", and after sign-in they land back where they were (store publish: the setup publish step).
  - **Forms report every field problem at once:** `Result` gains optional `fields` (`fieldErrors`, `errorFor` in `lib/result.ts`). A server message on a store-details field disappears once that field changes. An empty store name is caught in the browser with a message under the field.
  - **Product editor:** delivery and redirect links are checked in the browser with the server's https rule (`isHttpsUrl`). "Save and publish" is no longer silently disabled: with anything missing it lists the problems. The product link shown under More settings follows the title while the product is a draft (`lib/products/slug.ts`).
  - **Order access email:** a failed send logs the stage and Resend's error code and message (email addresses masked), so the cause shows in the logs and Sentry.
- **Why:** QA testing on pickstall.store (founder's QA sheet, 2026-11-19).
- **Consequences:** no schema change. The "Pay Pickstall" title on Stripe Checkout with the shared test account and the "Failed to fetch" console message on the store page were not changed (see the QA report).

## D-101: Store page sections (Phase 3, block 9: block page editor v1)
- **Date:** 2026-11-19
- **Decision (founder approved the plan, 2026-11-19):**
  - Optional `stores.pageBlocks[]`, validated by `pageBlocksInput` (`lib/page-blocks/rules.ts`, client-safe). Each section has an id and one of these types:
    - `text` (heading up to 80, body up to 2000; https links become clickable)
    - `image` (an upload `/media/...` or https, with alt text)
    - `video` (only a checked YouTube or Vimeo id; the embed URL is rebuilt from it, and the CSP frame-src already allows these hosts)
    - `links` (1-6 buttons, https only)
    - `testimonial` (quote and name)
    - `products`: the marker for where the product list goes. There is always exactly one, and it cannot be removed.
  - At most 12 sections besides the products. All text is cleaned of tags and length-limited, and React escapes it. Links open with `rel="noopener noreferrer nofollow ugc"`.
  - **Store page:** every one of the 8 layouts draws `StoreBlocks` before and after its product list (`splitBlocks`), in the theme's card style, colors, display font and radius. A store without sections looks exactly as before.
  - **Editor:** My Store → Page design → "Page sections". The creator adds a section from a menu, edits it in place, moves it with up/down buttons (keyboard-friendly; no drag yet), removes it and saves. The server checks everything again (`savePageBlocksAction`, only the session's store), and the live preview updates after saving.
- **Not in v1:** drag and drop, columns, separate landing pages, rich text in sections.
- **Why:** Phase 3 block-based page editor (PRD section 9).

## D-100: Import a subscriber list, and one Data page with every export (Phase 3, block 8)
- **Date:** 2026-11-19
- **Decision (founder: the creator confirms consent, option a, 2026-11-19):**
  - **Import (Marketing → Subscribers → Import a list):**
    - The browser reads the CSV (5 MB, 10,000 rows; parser in `lib/subscribers/import-rules.ts`, no new dependency).
    - The columns are guessed from the header, and the creator picks the email and name columns with a 5-row preview.
    - Only those two columns are sent, in parts of 2,000 rows, so each request stays under the 1 MB server action limit.
  - **On the server** (`importSubscribersAction` → `importSubscribers`):
    - Every row is checked again: a valid email, and the name cleaned and cut to 80 characters.
    - Duplicates are dropped, and only emails not already on the list are added (`$setOnInsert` upserts), so an unsubscribe is never undone.
    - The plan's subscriber limit caps the number added.
    - No welcome email is sent.
  - **Consent:** the creator must tick "These people agreed to get emails from me". Each person is saved as subscribed, with source `import` (the file name) and the consent text "Imported by the creator from {file} on {date}. The creator confirmed these people agreed to get their emails." This is a founder decision that departs from PRD section 9, where imported contacts are not marketable until re-permission.
  - **Settings → Data:** every CSV export in one place: products (new: title, type, price, status, public link; never delivery links or files), orders, customers and subscribers, plus a link to "Download my data" and to the import.
- **Not done:** Gumroad API import of products (needs Gumroad's docs verified and a creator token; postponed like TikTok and custom domains).

## D-099: Upsell after purchase (Phase 3, block 7)
- **Date:** 2026-11-19
- **Decision (founder approved the plan, 2026-11-19):**
  - Optional `products.upsell { productId, priceCents, headline }` on any product. It can name another digital product or course of the same store. A price of 0 makes it a free gift. It is set in the editors next to the order bump (`UpsellSection`).
  - **Offer:** the thank-you page shows it (`findUpsellOffer`) only when all of these hold:
    - The order is paid, is not itself a bump or upsell order, and was paid in the last 2 hours.
    - The offered product is published and of an allowed type.
    - The buyer has not bought it already.
    - The store can sell and its plan includes `upsells` (Pro; the trial and founding creators get it, D-098).
  - **"Yes, add it"** (`startUpsellCheckout`): the server checks the offer again and creates a normal pending order (`upsellOf: <paid order id>`). The price comes from the product in the database, and the buyer comes from the paid order, so nothing is asked again. It then goes through the same provider checkout (a new Stripe Checkout page; the card is entered again) or the free-order path, and the same webhook → paid → library → email.
  - There is no one-click charge: off-session charging would need saved cards on the creator's account, which is a payment-logic change for a later, separately approved block.
  - `orders_upsell_of` is a non-unique index: a buyer may retry after a failed or abandoned checkout. The offer hides itself once the buyer owns the product, so a double purchase needs two tabs paid at once (refundable).
  - Upsell orders are normal paid orders: they count in income and customers, unlike bump orders.
- **Unchanged:** no application fee, no transfers, direct charges on the creator's account; the `PaymentProvider` interface is unchanged.

## D-098: Plan limits enforced (Phase 3, block 5)
- **Date:** 2026-11-19
- **Decision (founder approved the plan; the free trial gets Pro features, 2026-11-19):**
  - `lib/config.ts` `PLAN_LIMITS` now carries `features` as well as the limits. All gating goes through `planLimits(access)`, `can(access, feature)`, `planProblem` and `videoHoursProblem` in `lib/plans/access.ts`.

    | | Trial / founding | Starter | Pro |
    |---|---|---|---|
    | Courses | unlimited | 5 | unlimited |
    | Course video | 100 h | 20 h | 100 h |
    | Subscribers | 10,000 | 1,000 | 10,000 |
    | Coaching calls | yes | no | yes |
    | Automations | yes | no | yes |

    Automations are the welcome email and the abandoned cart reminder. A paused store gets none of them.
  - **Enforced at:**
    - Creating a course (count of courses incl. drafts) and creating a coaching call (`?error=plan_courses` / `plan_coaching`).
    - Publishing (`changeProductStatus`): coaching needs Pro, and a course needs room among the published courses.
    - Starting a Bunny upload: total `video.durationSeconds` against the plan's hours.
    - Turning on the welcome email or abandoned cart: the actions refuse, and the jobs also skip on a plan without automations.
    - Broadcasts, as before: no sending over the subscriber limit.
  - **Downgrades never delete or unpublish anything.** Existing courses, calls and videos keep working, and subscribers keep being collected; only new or extra ones are blocked.
  - **Video length:**
    - `fetchVideoInfo` reads Bunny Get Video's `length` ("the duration of the video in seconds") and status.
    - `setBunnyVideoStatus` saves `video.durationSeconds` when a video is ready. The poll passes it; the Bunny webhook has no length, so it calls Get Video once, and a failure only leaves the length out.
    - `scripts/migrations/2026-11-19-video-durations.mjs` backfills older ready videos. Dry run by default; `--apply` writes. **The founder runs it.**
  - **UI:**
    - Settings → Plan shows a usage card (courses, video hours, subscribers, coaching and automations) and plan blurbs that list the limits.
    - The product type picker shows Coaching call as "Pro" (linking to the plan page) on plans without it.
    - The welcome email and abandoned cart switches are locked, with an upgrade link.
- **Why:** PRD F9 plan limits, through one helper (CLAUDE.md 5).

## D-097: Meta and Google pixels on store pages, after consent (Phase 3, block 4)
- **Date:** 2026-11-19
- **Decision (founder approved the plan, 2026-11-19):**
  - Creators enter a **Meta Pixel ID** and/or a **Google tag ID** (Marketing → Pixels). IDs only, strict patterns (`^\d{6,20}$`; `^(G|AW|GT|DC)-[A-Z0-9]{4,20}$`), checked again before reaching a page (`safePixels`).
  - Our own fixed snippets use these IDs, and creator scripts are never allowed. Data: optional `stores.pixels { metaPixelId, googleTagId }`.
  - **Where:** only on the store's public pages: store, product, checkout and thank-you. Never on platform pages, the library or the dashboard (the dashboard preview passes `pixels: null`). Gated with `can(access, "pixels")`, so there are none while the store is paused.
  - **Consent:**
    - `StorePixels` renders nothing on the server.
    - In the browser it shows an Allow / Decline banner, and loads nothing until Allow. The choice is kept per store in local storage (`ps_pixels_<storeId>`).
    - "Cookie settings" at the bottom of the page reopens it. Withdrawing calls `fbq('consent','revoke')` and reloads without the scripts.
    - While the banner shows, the platform cookie notice is hidden for that view (`suppressCookieNotice`), so the two never stack.
  - **Events:**
    - PageView: on start.
    - Product page: Meta `ViewContent` / Google `view_item`.
    - Checkout: `InitiateCheckout` / `begin_checkout`.
    - Thank-you page, only for a **paid** order: `Purchase` with `{eventID: orderId}` / `purchase` with `transaction_id`. The value and currency come from the order (integer cents converted with `priceDecimals`), and it fires once per order (local storage key).
  - **Snippets:** Meta's documented base code (connect.facebook.net/en_US/fbevents.js). The Google tag `gtag.js` with `gtag('config', ID)`: Google marks `config` deprecated but says existing installs keep working.
  - **CSP:** store pages (`/@…`, `/s/…`) get their own CSP with the pixel hosts. Google's hosts are from its CSP guide (with Ads); Meta documents `connect.facebook.net` and `www.facebook.com`. Every other page keeps the old CSP. The two header rules never match the same path.
  - **Legal:** the Cookie Policy gains a "Creators' pixels" section, and the Privacy Policy says what Meta and Google receive when a visitor allows them. Cloudflare R2 is added to the providers list.
- **Not done:**
  - **TikTok:** its official docs could not be fetched (every page failed), so it is not built; it follows once the docs can be verified.
  - Server-side Conversions API: needs vendor tokens, so it is not built.
  - Meta's full runtime host list is not documented. Check the browser's network tab during testing, and add hosts to the store CSP if a pixel request is blocked.
- **Why:** Phase 3 growth tools; pixels are in the Starter plan (PRD F9).

## D-096: Abandoned cart reminder (Phase 3, block 3)
- **Date:** 2026-11-19
- **Decision (founder, 2026-11-19):**
  - **Who:** one reminder goes to **everyone who started a paid checkout** and did not finish, not only buyers who ticked "Email me updates" (founder chose option b over the safer option a). The email says plainly that it is the only reminder.
  - **How:** after the provider's checkout session is created, `scheduleCartReminder` sends the Inngest event `checkout/started`.
    - The function `abandoned-cart-reminder` sleeps until two hours after the start (Stripe sessions expire after 60 minutes), then runs `sendCartReminder`.
    - Without Inngest (development) nothing is queued.
    - There is **no Stripe change**: Stripe's own recovery feature is not used.
  - **Sent only when** all of these hold:
    - The order is pending or failed, costs something, is not a bump's order, and was never reminded.
    - The store is published, has reminders on and can sell.
    - The product is still published.
    - The buyer has not paid for it since, was not reminded for it in the last 7 days, and has not unsubscribed from the store's list.
  - The order is claimed first (`reminderSentAt`), and the Resend idempotency key is `cart-<orderId>`, so it goes out once.
  - **Email:**
    - The creator's optional subject and message (only `{{customer_name}}` and `{{product_title}}`) or the default text.
    - Always added: a "Finish your order" button to `/@store/product/checkout`, and the line "You started a checkout at {store}. This is the only reminder you'll get for it."
    - Sent as "{store} via Pickstall".
  - **Settings:** an "Abandoned cart" card on the Marketing page with on/off (default off), the optional text and a preview. It shows the last 30 days: reminders sent, and how many of those buyers later paid for the same product.
  - New optional fields: `stores.abandonedCart`, `orders.reminderSentAt`. New partial index `orders_store_reminded`.
- **Risk noted:** reminders to buyers who did not tick consent may count as marketing in some countries (GDPR in the EU). There is one reminder only, it says so, and it never goes to anyone who unsubscribed from the store.
- **Why:** Phase 3 growth tools (PRD section 9).

## D-095: Broadcasts, one-click unsubscribe, welcome email, bounce and complaint webhook (Phase 3, block 2)
- **Date:** 2026-11-19
- **Decision (founder approved the plan, 2026-11-19):**
  - **Broadcasts** at `/dashboard/marketing/broadcasts`. The creator writes a subject and a plain-text message (cleaned of tags; `{{customer_name}}` is the only variable), sees a preview, sends a test to their own email (10 an hour), then confirms sending to everyone subscribed.
    - Limits: 3 broadcasts per store per 24 hours, and none while the list is over the plan's subscriber limit.
  - **Sending:** the Inngest function `broadcast-send` (concurrency 1, which keeps us under Resend's 10 requests/second) runs one step per batch of 100.
    - People are taken in `_id` order after a saved `cursor`.
    - Each Resend `batch.send` has the idempotency key `broadcast-<id>-<cursor>`, so a retried step sends nothing twice.
    - Development without Inngest sends after the response. Production without Inngest refuses to start.
  - **Every list email:**
    - It comes from "{store} via Pickstall" `<EMAIL_FROM address>`, with replies to the creator's sign-in email.
    - The footer is always present: the store name, why they get it and an unsubscribe link.
    - It carries the RFC 8058 headers `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
    - Tags `kind`, `store_id` and `subscriber_id` come back with webhooks.
  - **Unsubscribe:** every subscriber gets a random 32-character `unsubscribeToken` (unique index), given on insert or lazily before the first send.
    - `/u/<token>` asks before unsubscribing, because mail scanners open links.
    - `POST /api/unsubscribe/<token>` unsubscribes at once (one-click returns 200 with an empty body; the page's form returns to `/u/<token>?done=1`).
    - The email address is never shown. `unsubscribeReason` is one of user, creator, bounced or complained.
  - **Welcome email:** an optional `stores.welcomeEmail { enabled, subject, body }`, set on the Subscribers page. It is sent once per person (`welcomedAt` is claimed first) after a new subscription, via `after()`, so the sale is never slowed.
  - **Resend webhook** `POST /api/webhooks/resend`:
    - Svix signature checked with `resend.webhooks.verify` and `RESEND_WEBHOOK_SECRET`; deduped through `webhookEvents` (`resend:<svix-id>`).
    - `email.complained` and permanent `email.bounced` on broadcast or welcome emails unsubscribe that person in the tagged store only.
  - New collection `broadcasts` (index `broadcasts_store_created`); subscriber index `subscribers_store_status_id`.
- **Founder setup:** Resend → Webhooks → add `https://www.pickstall.store/api/webhooks/resend` with the events `email.bounced` and `email.complained`, then put its signing secret in Vercel as `RESEND_WEBHOOK_SECRET`. Inngest must be configured in production for broadcasts.
- **Risk noted:** every creator sends from the shared Pickstall domain. Consent-only lists, the daily cap, auto-unsubscribe on bounces and complaints, and one-click unsubscribe protect its reputation. Resend plan limits apply as lists grow.

## D-094: Email list and "Collect emails" lead magnets (Phase 3, block 1)
- **Date:** 2026-11-19
- **Decision (founder approved the plan, 2026-11-19):**
  - New product type `lead_magnet`, shown as "Collect emails" in the type picker. It is a digital product (file or link delivery, same editor) that is always free.
    - `updateProduct` forces price 0 and no discount. The publish rules refuse a price.
    - There is no order bump: the editor hides it and the checkout ignores it.
  - Its checkout goes through the normal free-order path (order → paid → library and confirmation email). There is no shortcut.
  - **Consent:**
    - Lead magnet (founder chose option a): the form says plainly that signing up includes emails, and submitting is the consent.
    - Every other checkout: an **unticked** "Email me updates and offers from {store}" box.
    - The server builds the consent words itself (`lib/subscribers/rules.ts`) and saves them on the order as `marketingConsent { at, text }`.
  - New `subscribers` collection:
    - Unique on `storeId` + `emailKey` (`subscribers_store_email_unique`), plus `subscribers_store_created` for the list.
    - Each entry saves its source (lead magnet or purchase, with the product) and its consent.
    - `addSubscriberForOrder` runs in `onOrderPaid`. It is an idempotent upsert that re-subscribes with the fresh consent, and a list error is only logged, never blocking the sale.
  - Dashboard → Marketing → **Email list** opens `/dashboard/marketing/subscribers`:
    - Count against the plan limit (`subscriberLimit(access)`, from `PLAN_LIMITS`; only subscribed people count).
    - Search, "Load more", CSV export (formula-neutralized) and per-row Unsubscribe or Delete.
  - Every query filters by the session's store id. Tests in `tests/unit/subscribers.test.ts` and `checkout.test.ts`.
- **Not in this block:** sending emails to the list, unsubscribe links and broadcasts (block 2). Until then the list only collects. The plan limit is shown, not yet enforced.
- **Why:** Phase 3 growth tools; lead magnets are in the Starter plan (PRD F9).

## D-093: Product and lesson files in a private Cloudflare R2 bucket
- **Date:** 2026-11-19
- **Decision (founder approved the plan, 2026-11-19):**
  - Product and lesson files go to a private R2 bucket through its S3 API. This uses the new dependencies `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (founder approved). Images stay in MongoDB (D-077).
  - Uploads happen in three steps, so a file never passes through the server; Vercel refuses request bodies over about 4.5 MB.
    1. `POST /api/products/[id]/file` or `POST /api/courses/[id]/lessons/[lessonId]/attachments` with `{ name, size }`. It checks the extension, the size (up to 200 MB), the target's owner (from the session) and the rate limit, then saves a `pending` file record. It returns a signed R2 PUT link (10 minutes; the content type is part of the signature).
    2. The browser uploads straight to R2 and shows progress.
    3. `POST /api/files/[fileId]/complete`. The server reads the stored size (HEAD) and the first 16 bytes (range GET), and checks the type against the name as before (D-050). Only then is the file marked `ready` and attached. Anything wrong deletes the bytes and the record.
  - The size is checked after the upload: the R2 docs do not say that a signed PUT can cap the size, and R2 has no POST policy.
  - Downloads keep every order, access and drip check. The buyer is then redirected (303, `no-referrer`) to a 60-second signed GET link that carries the download name.
  - Without R2, development and own servers keep the disk folder. The browser then uploads to `PUT /api/files/[fileId]` (only for a pending disk upload of the creator's own store).
  - The `files` collection gains optional fields `storage` ("r2" or "disk"; missing means disk) and `status` ("pending" or "ready"; missing means ready). No migration is needed. Pending files are never listed, counted or delivered.
  - The new partial index `files_pending_created` supports the daily Inngest job `files-pending-uploads-cleanup` (03:30 UTC), which deletes unfinished uploads older than a day.
  - CSP `connect-src` allows `https://*.r2.cloudflarestorage.com`.
  - The SDK client uses `requestChecksumCalculation` / `responseChecksumValidation: "WHEN_REQUIRED"`, so signed links do not demand a checksum the browser cannot send.
- **Env (server only):** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. When all four are set, uploads use R2.
- **Founder setup in Cloudflare:**
  - Create a bucket with public access off.
  - Create an R2 API token with "Object Read & Write" for that bucket only.
  - Add a CORS policy: `[{"AllowedOrigins":["https://www.pickstall.store","http://localhost:3000"],"AllowedMethods":["PUT"],"AllowedHeaders":["Content-Type"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3600}]`.
- **To verify on the live bucket:** the download name through `response-content-disposition` (not documented by R2), and a browser upload with the checksum setting.
- **Why:** files must work on Vercel without a paid service; the R2 free tier is 10 GB with free egress.

## D-092: Stripe set up for the two money flows (webhooks, Connect OAuth)
- **Date:** 2026-11-19
- **Decision (founder):** Pickstall uses Stripe in two ways, as the code already does:
  1. A creator pays for a Pickstall plan → the founder's Stripe account (Stripe Billing).
  2. A buyer pays for a creator's product, course or call → the creator's own Stripe account (Connect Standard, direct charge, no application fee, no transfers).
- **Set up in the Stripe sandbox (`acct_1UUlFe…`), 2026-11-19:**
  - Webhook `pickstall-platform` ("Your account") → `https://www.pickstall.store/api/webhooks/stripe`, 12 events: four `checkout.session.*`, `charge.refunded`, five `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`. Secret: `STRIPE_PLATFORM_WEBHOOK_SECRET`.
  - Webhook `pickstall-connect` ("Connected accounts") → `https://www.pickstall.store/api/webhooks/stripe-connect`, 7 events: four `checkout.session.*`, `charge.refunded`, `account.updated`, `account.application.deauthorized`. Secret: `STRIPE_CONNECT_WEBHOOK_SECRET`.
  - Connect OAuth turned on (by the founder), with the redirect `https://www.pickstall.store/api/connect/stripe/callback`. Client id: `STRIPE_CONNECT_CLIENT_ID`.
  - URLs use `www`: the bare domain redirects, and Stripe does not follow redirects.
- **Cause of the "pending" orders (D-091):** no webhook destination existed, so Stripe never told the site about payments. The two stuck checkout events were resent to `pickstall-platform` with the Stripe Shell (`stripe events resend … --webhook-endpoint=…`). Both were answered 200 "ok", and all orders show as paid.
- **Watch:** those deliveries took about 10 s each, likely a cold start including index setup. Stripe allows it, but the webhook should stay fast.
- `.env.example` and `CLAUDE.md` section 9 describe each Stripe variable and which flow it is for.
- **Why:** founder request, 2026-11-19.

## D-091: Sign-in code template, setup wizard feedback, optional Step 1
- **Date:** 2026-11-19
- **Decision (founder bug list):**
  - **Sign-in code email** uses the founder's Resend template, alias `verification-code` (`template.id` accepts an id or an alias; the template must be published). The code is passed as the variable `code` (`{{code}}` in the template, confirmed by the founder). If Resend refuses the template (not published, or a different variable name), the same code goes out as a plain email, so sign-in never breaks, and `email.sign_in_template_failed` is logged.
  - **Setup wizard:** the step just clicked shows a spinner until the next step loads (`useLinkStatus`), and changing steps scrolls to the top of the page.
  - **Step 1 (Store details):** photo and bio are really optional. "Save and continue" is enabled without them, and saving the step sets `StoreDoc.profileSavedAt`, which marks the step done. Older stores with a photo or bio still count as done. No migration.
- **Investigated, not a code change:** paid orders staying "pending" on the live site. An order becomes paid only when a verified Stripe event reaches our webhook (CLAUDE.md 7); a pending order means the event did not arrive or was refused. Stripe's delivery log shows our answer for each event ("ok", "ignored", "bad_signature", "error"), which names the setting to fix. Stores using the test seller shortcut need the platform endpoint (`/api/webhooks/stripe`, `STRIPE_PLATFORM_WEBHOOK_SECRET`, `STRIPE_PLATFORM_ACCOUNT_ID`); stores connected through Connect need the Connect endpoint (`/api/webhooks/stripe-connect`, `STRIPE_CONNECT_WEBHOOK_SECRET`, events from connected accounts). Both need `checkout.session.completed`, `checkout.session.expired` and `charge.refunded`.
- **Why:** founder request, 2026-11-19.

## D-090: Fixes from the live check (checkout summary, preview placeholder, health check)
- **Date:** 2026-11-18
- **Decision (from checking the live site in the founder's Chrome):**
  - **Checkout order summary** now follows the form: an applied coupon adds a "Code X −amount" line, a ticked order bump adds a "+price" line, and the total changes with both. A small client context (`components/store/checkout-totals.tsx`) is written by the coupon field and the bump box. The coupon box itself now says only "You save …". This is information only; the server still computes the amount (D-088, D-089).
  - **My Store's store preview** shows a skeleton until its box is measured (after the page's script loads) instead of a blank box.
  - **Health check** pings the database right after connecting, without waiting for the app's index setup, which made the first check after a deploy report a false "unreachable" (503).
- **Left as it is:** a missing store (`/@nobody`) answers HTTP 200 on the live site. Its page is streamed, so Next.js sends the status before the "not found" is known; it adds `<meta name="robots" content="noindex">` instead (checked on the live site), so search engines do not index it. A real 404 status would need a database check in a proxy on every store visit.
- **Why:** founder request, 2026-11-18.

## D-089: Order bumps (Phase 2)
- **Date:** 2026-11-18
- **Decision (founder approved the plan 2026-11-18):** a product can offer one other product of the same store at checkout. The buyer ticks it and pays once.
- **Settings:** an "Order bump" section on each product, in the Checkout form step of a digital product or the Publish step of a course or coaching call:
  - an on/off switch, the product to offer (a digital product or course of the store, not itself), an offer price above Stripe's minimum, and an optional headline (cleaned, 120 characters at most);
  - saved on its own (`saveBumpAction` → `ProductDoc.bump`), scoped to the session owner's store, and the target must be that store's;
  - the Marketing page's card now points there.
- **Checkout:**
  - The offer shows only when the bump product is still published in the store (`findCheckoutBump`). A tick sends `addBump`.
  - `startCheckout` reloads the bump from the database and adds the price saved on the product to the subtotal and total; the main item keeps its own price.
  - A coupon applies to the main product only.
  - Stripe gets one amount (direct charge, no application fee), and the payment page title reads "Main + Bump".
  - The order records `bump` (product, title, price).
- **Delivery:**
  - When the order is paid (only through the payment path), `createBumpOrder` makes one $0 order for the bump product (`bumpOf` = parent; unique index, safe on replays) and sends its own access email. So the bump reaches the library, downloads and course access unchanged.
  - A full refund of the parent also refunds the bump order, which removes access.
- **Counting once:** creator lists, customers, exports and income leave out `bumpOf` orders (`NOT_BUMP` in `lib/orders/creator-queries.ts`). The parent order carries the money, and its drawer lists the main product and the bump separately.
- **Schema:** `ProductDoc.bump`, `OrderDoc.bump`, `OrderDoc.bumpOf`, and a unique partial index `orders_bump_of_unique`. No migration.
- **Known limits:**
  - The checkout's coupon preview total does not include a ticked bump; the server's amount does.
  - A coaching call cannot be the bump, because it needs a booked time.
  - One bump per product.
- **Why:** PRD section 9, Phase 2.

## D-088: Coupons (Phase 2)
- **Date:** 2026-11-18
- **Decision (founder approved the plan 2026-11-18):** creators make discount codes on the Marketing page; buyers enter them at checkout. Coupons are available on every plan, including the trial.
- **Coupon** (`CouponDoc`):
  - a code, unique per store ignoring case;
  - a percentage (1 to 100) or a fixed amount in the store currency;
  - every product, or chosen products of the store;
  - an optional total-use limit, an optional end date (end of the creator's day), and "one use per buyer email";
  - an on/off switch.
- **Checkout:**
  - "Have a discount code?" → Apply calls `previewCoupon` (rate limited, 20 tries per 15 minutes per visitor) and shows the saving and the new total. Information only.
  - `startCheckout` finds the code in that store, checks it, and computes the amount from the database: the coupon comes off the price the buyer would pay, after any sale price. A total above 0 but below Stripe's minimum charge is refused. A 100% coupon goes through the free path.
  - The order records `coupon` (id, code, discount), and its discount is part of `discountCents`.
- **No over-use:**
  - At order creation one use is held with a single atomic update (active, unexpired, under its limit). A once-per-email code also needs a free unique `activeEmailKey`.
  - A failed or expired payment (`payment.failed`, `markOrderFailed`) gives the use back.
  - A paid order, through the verified webhook, mock or free path only, marks it redeemed.
  - A refund keeps the use counted.
  - Tested on a real MongoDB with 8 buyers against a 3-use limit.
- **Payments:** unchanged. The `PaymentProvider` charges the server's lower amount as a direct charge with no application fee; no Stripe coupon objects are used.
- **Creator side:** the order drawer shows the code and its discount. All coupon reads and writes filter by the session owner's store, and a coupon can only name that store's products.
- **Schema:** new collections `coupons` (unique `storeId + codeKey`) and `couponRedemptions` (unique `orderId`; unique partial `activeEmailKey`), plus `OrderDoc.coupon`. No migration.
- **Not in this part:**
  - Editing or deleting a coupon: turn it off and make a new one.
  - A coupon column in the CSV export.
  - Order bumps, which come next as their own part.
- **Why:** PRD section 9, Phase 2.

## D-087: Pre-QA fixes: Customize design, prerender errors, coaching wording, locks, publish redirect
- **Date:** 2026-11-18
- **Decision (founder report before handing the site to a QA tester):**
  - **"Customize design" did nothing** while My Store was open: the tabs read `?tab=` only on first load. `MyStoreTabs` now follows the URL (state adjusted while rendering), and the button and command menu open `/dashboard?tab=design#my-store-tabs`.
  - **Prerender errors (red dev "Issue"):** `findPublicStore`, `loadCheckoutContext` and `findPendingMockOrder` now call `await connection()` before the database is touched (the driver reads the clock, which Next refuses while prerendering). This affected the store, product, checkout, thank-you and mock-pay pages. The old `/dashboard/store` redirect page sets `instant = false`.
  - **Coaching on buyer pages:**
    - Store cards show a calendar icon and "Coaching call · 30 min".
    - The product page lists what the call is, instead of "Delivered by email", and its default button text is "Book a call".
    - The thank-you page shows the booked time and calendar steps.
    - Public products expose only `coaching.durationMinutes`, never the meeting link or the hours (tested).
  - **Any free product** shows "Free" on its product page.
  - **Settings sub-nav:** Store and Payments show a lock and are not links while setup is incomplete (D-079).
  - **After publishing**, the digital, course and coaching editors go to `/dashboard/products?published=1`, which shows a "Published" message; from the setup wizard they still go to the next setup step.
- **Why:** founder request, 2026-11-18.

## D-086: Coaching calls, part K5: calls list and cancel with refund
- **Date:** 2026-11-18
- **Decision:**
  - **Upcoming calls** card at the top of Orders (`components/dashboard/upcoming-calls.tsx`), shown only when the store has calls. It lists confirmed calls still ahead and every "conflict" ("Needs a new time"), soonest first, in the coach's time zone. A row opens the order drawer.
  - **Order drawer, "Call" section:** the time, the booking state, and for a paid order with a confirmed or conflict call, **"Cancel call and refund"** (or "Cancel call" for a free one), behind a confirmation dialog.
  - **`cancelCall` action** (`lib/coaching/call-actions.ts`): uses the session owner's store only and is rate limited with the refund limit.
    - A paid call is refunded in full **first**, through the same path as the Refund button. That path moved into the server-only `requestFullRefund` (`lib/orders/refunds.ts`), which `refundOrder` now calls too; its behaviour is unchanged, so there is still one refund path and the Stripe idempotency key per order.
    - Only once the provider accepts the refund is the booking set to `cancelled`. That frees the time; reminders skip it because they check the booking first.
    - The buyer then gets a "Your call was cancelled" email (once, outbox kind `call-cancelled`).
    - If the refund fails, the call is kept. A free call is just cancelled.
  - **Refund from anywhere cancels the call:** a verified full refund event (from the drawer or the Stripe Dashboard) also cancels the booking (`cancelBookingOfRefundedOrder` in the payment path).
  - **Buyer's library:** a cancelled call says the coach cancelled it and whether it was refunded.
  - **Schema:** `BookingDoc.status` adds `"cancelled"` (with `cancelledAt`), and `EmailOutboxDoc.kind` adds `"call-cancelled"`. No migration.
- **Not in K5:**
  - Rescheduling, by the buyer or the coach (founder: later).
  - A creator email for new bookings: the creator still gets the in-app "New sale" notification.
  - A full calls history page: past calls stay in Orders.
- **Why:** plan part K5 (D-081).

## D-085: Coaching call reminders through Inngest
- **Date:** 2026-11-18
- **Decision (founder chose Inngest, free plan, 2026-11-18):**
  - New dependency `inngest@4.26.2`, pinned exactly; released 29 Oct 2026, about three weeks old. pnpm is told not to run the build script of its sub-dependency `protobufjs` (`pnpm-workspace.yaml`, like the other denied scripts).
  - Client: `lib/inngest/client.ts`. Route: `app/api/inngest/route.ts` (`serve` from `inngest/next`, exporting GET, POST and PUT). The SDK verifies Inngest's requests with `INNGEST_SIGNING_KEY`. API shapes were checked in the installed package's README and types, not guessed.
  - When a booking becomes confirmed (only in the paid-order path), `scheduleCallReminders` sends one `coaching/call.confirmed` event whose id is `call-confirmed-<orderId>`. A replayed webhook sends the same id, so Inngest runs the function once. It never throws, and it is skipped when Inngest is not configured (no `INNGEST_EVENT_KEY`; in development `INNGEST_DEV`).
  - The function `coaching-call-reminders` works out, in a step, which reminders are still ahead (24 hours and 1 hour before; a call booked 3 hours ahead gets only the 1-hour one), sleeps until each (`step.sleepUntil`), then sends it.
  - **Each send checks again** that the order is paid, the booking is confirmed, the call has not started, and its start is still the same. So a call refunded, cancelled or moved later (K5) gets no stale reminder.
  - **One outbox row per order and reminder** (`<orderId>:call-reminder-24h` / `-1h`, new `EmailOutboxDoc.kind` values): a retry never emails twice. A failed send throws, so Inngest retries that step.
  - Reminder email (`renderCallReminder`): fixed text with the sender identity, the time in the buyer's zone, the join link (or that the coach sends it) and a link to the booking in the library.
  - Env: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` (server only) and `INNGEST_DEV` for local development. The setup steps are in `docs/DEPLOY_VERCEL.md` section 7b.
- **Why:** plan part K4 (D-081). Vercel's Hobby plan runs crons only daily, too coarse for a 1-hour reminder.

## D-084: Coaching calls, part K4: booking email, calendar file and library card
- **Date:** 2026-11-18
- **Decision:**
  - **Buyer's email:** the confirmation email of a coaching order always carries the booking, whatever the creator wrote: the call time in the buyer's own time zone (from the booking page; else the coach's), and the meeting link or "the coach will email you the link". A late "conflict" booking says the time was taken and the creator will get in touch. The default subject for a confirmed call is "Your call is booked: …". The sender identity and the access link are still always included (D-014).
  - **Calendar file:** a confirmed call's email has a `call.ics` attachment (RFC 5545, UTC times, escaped and folded text, `lib/coaching/ics.ts`). `sendEmail` accepts attachments (Resend `attachments` with filename, content and content type, checked in the installed resend 6.x types).
  - **Library:** coaching purchases are kind "coaching". The purchase page shows a call card (time, "Join the call", "Add to calendar"), and the list card shows "Coaching call · Call on <date>" and "View booking". The meeting link is given only for a confirmed, paid (not refunded) booking, to the buyer whose verified email matches. "Add to calendar" downloads from `/library/<order>/call.ics`, which checks the same rules.
  - Checkout's email hint for a coaching call reads "Your booking and receipt go here."
- **Not in K4:**
  - **Reminder emails** (24 hours and 1 hour before) need a scheduler. The project has neither Inngest nor a cron yet, and Vercel's Hobby plan runs crons only once a day, so the founder picks the approach first.
  - **No email to the creator:** the app has no creator emails yet, and the creator still gets the in-app "New sale" notification. A creator booking email can come with K5.
- **Why:** plan part K4 (D-081).

## D-083: Coaching calls, part K3: booking at checkout
- **Date:** 2026-11-18
- **Decision (founder approved the K3 plan 2026-11-18):**
  - **Buyer flow:** the checkout page of a coaching call shows a day and time picker (`components/store/slot-picker.tsx`) with the slot engine's open times (D-082), in the buyer's own time zone. The picked start and the buyer's time zone go to the server as hidden fields. The button reads "Book and pay" (or "Book for free").
  - **Server check:** `startCheckout` ignores the browser's time: it loads the store's busy times around the pick and accepts it only if `findSlot` offers that exact start now. The order stores the server's slot (`OrderDoc.booking`: start, end, buyer time zone).
  - **New `bookings` collection** (`BookingDoc`), one booking per order, status held → confirmed / released / conflict. Indexes: unique `activeSlot` (store + start, only while held or confirmed), unique `orderId`, and `storeId + start`.
  - **Hold:** the time is held for 65 minutes while the buyer pays (a Stripe checkout session expires after 60). A hold that ran out is let go when someone else wants that time. If the hold fails, the order is marked failed and the buyer is asked to pick again.
  - **No double booking:** the unique index stops two calls starting together. Overlapping calls of different lengths are settled after the write: the booking created first keeps the time and the other lets go, and both sides use the same rule.
  - **Confirm only from the payment path:** `onOrderPaid` (verified webhook, mock through the same handler, or the free-order path) confirms the booking, and a replay changes nothing. A failed or expired payment (`payment.failed`, `markOrderFailed`) releases it. The success page never confirms anything.
  - **Late payment:** if the time was taken meanwhile, the booking becomes "conflict" and the order stays paid. The creator sorts it out in K5 (logged as `coaching.booking_conflict`).
  - The "booking turns on in the next update" publish rule from D-081 is removed: coaching calls can be published, and the editor's last button is "Save and publish".
  - The checkout context reads only the coaching booking rules, never the meeting link.
- **Unchanged:** prices come from the database, charges are direct on the creator's Stripe account, there is no application fee, and the `PaymentProvider` interface and its code are not changed.
- **Also fixed:** on phones the checkout grid column now stays inside the screen (`grid-cols-[minmax(0,1fr)]`).
- **Known:** the dev-only "new Date() while prerendering" warning on the checkout route comes from the existing `loadCheckoutContext` database call (an open follow-up from before), not from this change. Emails, the .ics file, reminders and the library call card are K4; the creator's calls list and cancel/refund are K5.
- **Why:** plan part K3 (D-081).

## D-082: Coaching calls, part K2: the slot engine
- **Date:** 2026-11-18
- **Decision:** call start times are computed by one pure function, `availableSlots(settings, busy, now)` in `lib/coaching/slots.ts`, used by both the booking page (K3) and the server. Rules:
  - Slots follow the weekly hours in the coach's time zone, back to back from the start of each range: each is `durationMinutes` long, with `bufferMinutes` of break before the next, and must end by the end of its range.
  - Only starts between now plus the minimum notice and now plus the booking window are offered.
  - A slot that overlaps a busy time (a booked or held call of any of the store's coaching products, from K3) is dropped, with the break kept on both sides.
  - Daylight saving: a wall time that does not exist (clocks go forward) is skipped; a time that happens twice (clocks go back) uses the first.
  - At most 5,000 slots are returned (90 days of 15-minute calls fits).
- **Server check:** `findSlot` accepts only a start that the engine itself offers at that moment. K3 calls it before holding a time, so a time sent by a browser is never trusted on its own.
- **Booking page helper:** `slotsByDay` groups slots by the buyer's own calendar day.
- **No date library:** time zone maths uses `Intl` only (`lib/coaching/time-zones.ts`), so there is no new dependency. Tests cover India (no DST), New York on both DST days and the 90-day window.
- **Why:** plan part K2 (D-081).

## D-081: Coaching calls, part K1: product type, editor and availability
- **Date:** 2026-11-18
- **Decision (founder approved the plan 2026-11-18):** coaching calls use a built-in booking calendar (not a Calendly-style link), on every plan. In the first version only the creator cancels (with a refund); buyer rescheduling and Google Calendar sync come later. The work ships in five parts: K1 editor and availability, K2 slot engine, K3 booking at checkout (slot hold, webhook confirms), K4 emails, .ics and reminders, K5 calls list and cancel/refund.
- **K1 (this entry):**
  - New product type `"coaching"` with `ProductDoc.coaching` (`CoachingSettingsDoc`): call length (15/30/45/60/90 min), IANA time zone, weekly hours (ISO weekday plus `HH:MM` ranges, up to 3 a day, no overlap, each fits one call), break after each call, minimum notice, how far ahead buyers can book, and an https meeting link or "I'll send it later". New calls start at 30 minutes, weekdays 09:00 to 17:00, link sent later. No migration: there are no users yet, and nothing else in the product changes.
  - **Time zone lives on the coaching product**, not on the store as the plan said: it is only needed by coaching, so it stays with it. The editor fills in the creator's browser zone until it is saved. Double-booking across a creator's calls is handled by the bookings collection in K3, not by the time zone.
  - The meeting link is never in public reads; it goes to buyers after they book (K4).
  - Coaching editor (`components/dashboard/coaching-editor.tsx`): Details, Availability, Price & publish, with a live card preview. One JSON payload, checked again on the server (`lib/coaching/schemas.ts`); the save is scoped to the session owner's store and `type: "coaching"` (`lib/coaching/queries.ts`). The digital product editor and file upload now skip both courses and coaching calls.
  - **A coaching call cannot be published yet:** the publish rules add "Booking turns on in the next update" (`COACHING_BOOKING_PENDING`), so nothing can be sold without a booking calendar. K3 removes that rule.
  - The type picker's "Coaching call" card is live; the product list labels coaching calls.
- **Why:** founder request, 2026-11-18.

## D-080: Setup wizard matches the onboarding screen; one soft border everywhere
- **Date:** 2026-11-18
- **Decision (founder request, screenshot of /dashboard/setup):**
  - The wizard's stepper uses the onboarding screen's steps (D-079): icon tiles with number badges (done = mint check, current = blue, rest gray), the names Store Details, Add Products, Set Payments and Go Live, and chevrons between them on wide screens. Both screens share `components/dashboard/setup/step-tile.tsx`.
  - Every card, tile, list row, selected option and secondary button uses the same border as the sidebar "Upgrade to Pro" card: 1px `--line`. The current or selected item is shown with a `--blue-soft` fill (theme picker, current step) instead of a blue border; done items in "Your store so far" get a light gray fill and a mint check instead of a mint border and fill. The store preview phone loses its shadow.
  - Secondary buttons change app-wide: 1px `--line` at rest, `--border-input` on hover (DESIGN.md 9.1 updated). Checkboxes and radios keep their stronger edge (D-067).
- **Trade-off:** like D-067 for fields, a secondary button's resting border is below 3:1 contrast; its text label, hover and focus ring carry it.
- **Why:** founder request, 2026-11-18: borders on cards, buttons and shapes looked different from each other.

## D-079: Onboarding screen and a locked dashboard until setup is done
- **Date:** 2026-11-18
- **Decision (founder request, reference screenshot):** while setup is incomplete, My Store shows an onboarding screen instead of the full page (supersedes the D-076 "full My Store during setup" rule): a storefront illustration, "Set up your store to get started", the four setup steps (Store Details, Add Products, Set Payments, Go Live) with real progress (done = mint check, next = blue number, rest gray) and "Set Up My Store" into `/dashboard/setup`.
- **When it unlocks:** `buildChecklist().complete` (D-045 steps, all from store data, nothing new stored) OR the store has a paid or refunded order. The founder confirmed there are no users yet, so no migration is needed; the order rule means a store that has sold never loses its orders when a step is undone later (unpublished, bio removed).
- **Locks:** every sidebar and bottom-bar section except My Store shows a lock, is not a link (`role="link"`, `aria-disabled`, still focusable) and has the tooltip "Finish setting up your store first". Server side, `requireUnlockedCreator(path)` (`lib/dashboard/setup-gate.ts`) redirects Products, Orders, Customers, Income, Marketing, Analytics, Settings > Store and Settings > Payments to `/dashboard`. Open while locked (`lib/dashboard/setup-lock.ts`): My Store, the setup wizard, the product editor and preview (the "Add products" step opens it), Settings > Account (sign out, delete account) and Settings > Plan (billing). The CSV export routes are not locked: a locked store has no orders, so they export nothing. Server actions stay open because the setup wizard uses them.
- **Top bar and footer while locked:** search and "View my store" are hidden (nothing to find or show yet); the bell and account menu stay. The sidebar footer says "Store not set up".
- **Product create errors** from the setup wizard now go back to its product step (`?step=first-product&error=`), which shows them, instead of the locked products list.
- **"Watch 2 min setup guide"** from the reference is left out until there is a video.

## D-078: Courses get the creator's confirmation email
- **Date:** 2026-11-18
- **Decision (founder request):** the course editor's Publish step has the same "Confirmation email" box as digital products: an optional subject and message with `{{customer_name}}`, `{{product_title}}` and `{{download_link}}` (for a course, the link where the student creates a password and opens the course). One shared component (`ConfirmationEmailFields`) is used by both editors.
- **How it saves:** the email is part of the course details payload, so "Save and publish" and every course save keep it; a "Save email" button saves it on a course that is already published. The server checks it with the same `emailText` rules as digital products (only the three variables, 120 / 2,000 characters, no HTML) and writes only `afterPurchase.emailSubject` and `afterPurchase.emailBody` (dotted paths) on the session store's own course.
- **Sending:** unchanged. `sendOrderConfirmation` already used the product's saved subject and message for any product type; the store name and access link are always added. No schema change: course documents already have `afterPurchase` (older ones get it on their next save).
- **Why:** founder request, 2026-11-18.

## D-077: Images in MongoDB; file uploads off on the live site (founder decision)
- **Date:** 2026-11-17
- **Decision:**
  - Uploaded images are saved in MongoDB (`mediaBlobs`, keyed by the upload's storage key, `storeId` indexed) instead of the server's disk, which Vercel cannot keep. Serving is unchanged (`/media/<id>`, cached as immutable). In development, images uploaded to disk before this still show.
  - Image limit 4 MB (was 5 MB), so the upload fits Vercel's ~4.5 MB request limit. Each store gets 60 MB of images (`MEDIA_STORE_QUOTA_BYTES`). When it is full, the store's own images that nothing shows (not the store photo, not any product or course cover, older than one hour) are deleted first.
  - Product and lesson file uploads are off in production unless `PRODUCT_FILES_DIR` is set (own server): routes answer 503 with a clear message, the editors disable the upload and point to delivery links.
- **Why:** founder decision, 2026-11-17: no paid storage service for now. Saving into the project folder cannot work on Vercel (read-only, wiped between instances).
- **Consequences:** Atlas storage grows with images (free M0: about 512 MB in total), so watch it and move images to object storage (R2, chosen earlier, free up to 10 GB) before it fills. File delivery by upload returns with object storage. No migration: no live images existed (uploads failed on Vercel).

---

## D-076: Full My Store during setup, checkout preview, access email status (founder bug report)
- **Date:** 2026-11-17
- **Decision:**
  - **My Store during setup** now follows `docs/ui-reference/dashboard.webp` (supersedes the D-045 rule "greeting and checklist only"). It shows the welcome card, then the store link card and a compact "Get started" list side by side (each row opens its step on `/dashboard/setup`), then KPIs, the Products / Store design / Links / Analytics tabs and the store preview with help on the right. Once setup is done the two cards go away, as before. The store link card and the tab bar respond to their own width (container queries), so nothing is squeezed next to the preview column.
  - **Sidebar plan card:** links to Settings > Plan ("See plans") instead of "Coming soon", lists what Pro really adds (from `PLAN_LIMITS`; 0% fees is on every plan), hides on Pro, and shows the creator's real status (Free trial, Founding creator, Starter or Pro plan, Payment due, Store paused) instead of "Free plan".
  - **Checkout preview:** on the product editor's "Checkout form" step, the preview shows the buyer's form (headline, name, email, phone if asked, every question with its answer type, and the button), updating as fields are added. Before, it showed only the product card and a count, so a new field looked missing.
  - **Access email:** the order drawer shows "Access email: Sent / Not delivered / Not sent" from the email outbox, with "Send again" (rate limited, own store only, never resends a delivered email). A send cut off half way is retried after 10 minutes. In production, a sender that is Resend's test address (`EMAIL_FROM` unset or `@resend.dev`) is reported as `email.sender_not_verified`, and `pnpm doctor` warns. Resend delivers such mail only to the account owner, which is why the founder's own tests worked and buyers got nothing.
- **Why:** founder bug report, 2026-11-17.
- **Consequences:** the founder sets `EMAIL_FROM` on a domain verified in Resend (docs/DEPLOY_VERCEL.md step 5). Image and file uploads on Vercel still need object storage (DEPLOY_VERCEL section 0), which is the founder's choice.

---

## D-075: Monitoring, audit log, health check and ops runbook (Phase E)
- **Date:** 2026-11-17
- **Decision:**
  - **Sentry** (`@sentry/nextjs`) on server, edge and browser, with `lib/monitoring/sentry-options.ts` shared. It is **off unless `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are set**. Data collection is off (no user info, cookies, headers, bodies or query params), and `scrubEvent` also strips them and replaces the `/welcome/<token>`, `/library/<orderId>` and `/mock-pay/<orderId>` segments. Traces are sampled at 5% in production only. Browser reports go through `/monitoring` on our domain. `logger.error` also reports to Sentry. Error pages (`app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, dashboard error) show a calm message and report the error.
  - **Audit log:** an `auditLogs` collection (`lib/audit/log.ts`) records sign-ins, store publish and unpublish, link change, Stripe connect and disconnect, plan checkout, start and change, product delete, data download, "sign out other devices" and account deletion. It holds ids, a hashed IP (sign-ins only) and small safe meta values; no emails or tokens. Indexes: `{ actorId, at }`, plus a TTL after 400 days. `recordAudit` never throws. Each person sees their own last 15 entries in Settings > Account and on `/account` (read by session user id only).
  - **Sign out other devices:** Better Auth `revokeOtherSessions` (session from the cookie), rate limited 10 per hour.
  - **Health check:** `GET /api/health` returns `200 {status:"ok"}` or `503 {status:"degraded"}` after a database ping with a 3-second timeout. No versions or error text, never cached.
  - **CI:** adds `pnpm test:integration` (in-memory MongoDB, binary cached) and a separate `pnpm audit --prod --audit-level=high` job, also run weekly.
  - **Ops:** `docs/OPS_RUNBOOK.md` covers the uptime monitor, Sentry alerts, Atlas backups and restore test, load test, independent review, and incident steps. The Privacy Policy now lists Sentry, the activity log and its retention.
  - **2FA skipped for now:** creators sign in with an email code, so each sign-in already proves inbox control. Authenticator apps can come later.
- **Why:** PRD 6 (observability, audit log, backups) before launch. The founder asked for a project that is hard to hack or crash and gets noticed fast when something breaks.
- **Consequences:** the founder must create the Sentry project, the uptime monitor and Atlas backups (runbook). No schema migration is needed: the collection and indexes are created on first start. Audit writes add one small insert to each recorded action.

---

## D-074: Legal pages, cookie notice, Terms acceptance, data download and account deletion (Phase D)
- **Date:** 2026-11-15
- **Decision:**
  - **Pages** (shared layout `components/legal/legal-page.tsx`): `/terms`, `/privacy`, `/refunds`, `/acceptable-use`, `/copyright`, `/cookies`, linked from the landing footer and each other. Plain-language drafts that describe what the code does today (creator is the seller of record and controller of buyer data, not a merchant of record, 0% fees, 30-day trial and pause, Stripe/Resend/Bunny/MongoDB Atlas/hosting as processors), covering GDPR / UK GDPR, CCPA and India's DPDP Act 2023 and IT Rules 2021 (Grievance Officer, acknowledge in 24 hours, resolve in 15 days). **A lawyer must review them before real money** (PRD 8.2).
  - **Operator details** live in one place, `lib/legal.ts`; values in [BRACKETS] are unknown, and the pages show a "draft" notice until none remain (`legalPlaceholders()`).
  - **Cookies:** every cookie we set is strictly necessary (Better Auth session cookies, `signup_intent`, `ps_device`), so the notice informs instead of asking consent; closing it is remembered in local storage. Adding analytics or ads requires a real consent choice first.
  - **Terms acceptance:** a required checkbox on signup and on the username step (accounts created from the login page or Google); the accepted version (`LEGAL.termsVersion`) and time are saved on the profile. Checkout links the Terms and Privacy Policy.
  - **Download my data** (`/account/export`, Settings > Account and `/account` for buyers): JSON with profile, store, products, sales and purchases, keyed by the session; no sign-in secrets; 5 per hour.
  - **Delete account:** type DELETE; Better Auth's `deleteUser` checks the session is fresh (signed in within a day), then our `beforeDelete` cleanup (`lib/account/delete-account.ts`): cancel a running plan at Stripe (if that fails, nothing is deleted), disconnect Stripe Connect, anonymise and unpublish the store and free its username, unpublish products (kept so buyers keep what they paid for), delete the profile, and keep only a one-way hash of the email (`deletedAccounts`) so a new store with that email gets no second free trial. Orders stay for tax records. Better Auth then deletes the user and all sessions.
- **Founder actions:** fill in `lib/legal.ts`; for live Stripe payments in India, a registered business is needed (D-073); have the texts reviewed by a lawyer.
- **Not built:** email footer with the postal address (CAN-SPAM) until the address is known; deleting uploaded image files from disk on account deletion; a cookie consent choice (not needed while all cookies are necessary).

## D-073: Paid plans with Stripe Billing on the platform account (Phase C)
- **Date:** 2026-11-15
- **Decision:**
  - Creators subscribe to **Starter** or **Pro** (`PAID_PLANS`, monthly, USD, prices from `PLANNED_PRICE_CENTS`) through Stripe Checkout in subscription mode on **our own** Stripe account. This is the only way the platform earns (CLAUDE.md 7); nothing touches a creator's connected account, sets an application fee or moves creator money. Test mode until live is approved.
  - Prices are created in Stripe on first use with lookup keys `pickstall_<plan>_monthly`; a changed amount creates a new price that takes the key over (`transfer_lookup_key`), so existing subscribers keep their price until they switch. No Dashboard setup for prices.
  - Checkout requires the billing address and saves it on the customer: Stripe India needs the customer's name and address for payments from outside India (export of services). The product name is the invoice description.
  - `stores.billing` (customer, subscription, plan, status, period end, cancel-at-period-end) is written only by `applySubscriptionState` from a subscription **fetched from Stripe**: on platform webhooks (`customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, `checkout.session.completed` in subscription mode) and on the Checkout return route (`/api/billing/return`, which checks the Checkout belongs to the creator's store). Fetching instead of trusting the event body makes duplicates and out-of-order events harmless; events are still recorded in `webhook_events` first.
  - Guards: one Stripe customer per store (unique index), a store only accepts its own customer, and an ended subscription never replaces a different one that still gives access (late events).
  - Access (`lib/plans/access.ts`): `active`/`trialing` = open with the plan; `past_due` = open with a warning while Stripe retries; anything else falls back to founding, trial or paused. A cancelled plan stays active to the end of the paid month.
  - Settings > Plan: choose a plan (Checkout), switch plan in place (`create_prorations`: the difference goes on the next invoice), Manage billing (Stripe customer portal: card, invoices, cancel). The dashboard banner covers failed payments and a cancelled plan's last week.
- **Founder actions:** add the subscription events to the platform webhook endpoint and save the customer portal settings in Stripe (docs/DEPLOY_VERCEL.md section 6). For live mode Stripe India needs a registered business (sole proprietorship, LLP or company), not an individual.
- **Not built:** yearly plans, coupons for plans, plan feature limits beyond open/paused, emails about failed payments (Stripe can send its own).

## D-072: 1-month free trial; the store pauses when it ends (Phase B)
- **Date:** 2026-11-15
- **Decision (founder, 2026-11-15):**
  - Every new store starts with a **30-day free trial** (`TRIAL_DAYS`): `stores.planTier = "trial"`, `stores.trialEndsAt`.
  - **Founding creators** (at most 10, `FOUNDING_SPOTS`) are free for 6 months (`FOUNDING_MONTHS`): `planTier = "founding"`, `foundingEndsAt`, granted only by the founder with `scripts/admin/grant-founding.mjs`.
  - When the free period ends without a paid plan the store is **paused**: the public store, product and checkout pages show "taking a short break" in the creator's theme (no plan details are shown to buyers), checkout refuses new orders (free ones too), and products and the store cannot be published. Nothing is deleted or unpublished; unpublishing still works; the dashboard, orders, customers and buyers' libraries keep working; already-paid orders are still fulfilled.
  - One rule for all of it: `storeAccess()` and `can(access, "sell" | "publish")` in `lib/plans/access.ts` (CLAUDE.md 5). Public reads expose only `isOpen` / `open`, never the plan fields.
  - Dashboard: a banner (info during the trial, warning in the last 5 days, error when paused; founding creators only in their last 2 weeks) and Settings > Plan. Paid plans and the subscribe buttons come with billing (Phase C); until then the Plan page points to support.
  - Stores created before D-072 count as an open trial until `scripts/migrations/2026-11-15-store-trials.mjs` gives them a trial of 30 days **from the day it runs**, so no existing creator is paused at once.
  - Landing copy mentions the 30-day free trial (hero, pricing buttons, claim form, FAQ).
- **Why:** founder decision; the trial only means something if it ends (paired with Phase A against repeat trials).

## D-071: Account safety before the free trial (Phase A)
- **Date:** 2026-11-15
- **Decision (founder, 2026-11-15):**
  - **Existing email on signup:** the signup form says "This email already has an account. Log in instead." This deliberately overrides the CLAUDE.md 8 "don't reveal whether an email exists" rule for the signup form only. To keep it from being used to list registered emails, the check is limited to 15 per hour per IP and per browser (`SIGNUP_EMAIL_CHECK_RATE_LIMIT`). The login page still answers the same way for every email.
  - **One store per inbox:** `canonicalEmail` (lib/auth/email-rules.ts) folds Gmail dots, `+tags` and googlemail.com into one key; `stores.ownerEmailKey` has a unique index, so `maya+2@gmail.com` cannot open a second store next to `maya@gmail.com`.
  - **No throwaway inboxes** for new stores (lib/auth/disposable-domains.ts, a curated list to grow as needed).
  - **Soft limit per browser and IP:** at most 2 new stores per browser and 5 per IP in 30 days (`STORE_CREATION_LIMITS`); beyond that the creator is asked to email support. The browser id is a random first-party cookie (`ps_device`, only its hash is stored), not a fingerprint. The IP limit is higher because mobile networks share addresses.
  - **One real Stripe account per store:** a Connect OAuth connection sets `stores.stripeClaimKey` (unique index); a second store gets "That Stripe account is already in use". The test-mode shortcut (D-034) is not exclusive.
  - All store-creation checks live in one gate (`lib/stores/new-store-guard.ts`) called before `createDraftStore`, because the login page and Google also create accounts (on first sign-in) and reach the username step; a check only on the signup form would be bypassed.
- **Also fixed:** `?blocked=` and `?stripe=` lookups used the `in` operator, so `toString` matched the object prototype; they use `Object.hasOwn` now. A lint error in the username field (setState inside an effect) was replaced by `useSyncExternalStore`. The signup and username forms submit by hand (`preventDefault` + `startTransition`) so React 19's automatic form reset no longer clears what the creator typed when the server answers with an error.
- **Migration (founder runs):** `node --env-file=.env.local scripts/migrations/2026-11-15-store-identity-keys.mjs` (dry run), then with `--apply`. It fills the two keys on older stores; when old stores already share an inbox or a Stripe account, the oldest keeps the key and the rest are listed, not changed.
- **Why:** stop free-trial abuse before the 1-month trial (Phase B) and billing (Phase C).

## D-070: Library as a card grid with course progress (H6c)
- **Date:** 2026-11-04
- **Decision (founder OK for the extra read):** the buyer library shows purchases as cards (2 per row from `sm`): cover, a Course / Digital product badge, Refunded / Unavailable / Access ended when they apply, title, store and date, and for a course a progress bar with "N of M lessons done". The card's action says what happens next: Start course, Continue, Review course, Open, or View details. An open course goes straight to the player; anything else to its library page as before. The loading state is a card-shaped skeleton; the empty state is unchanged.
- **Data:** `listPurchases` / `findPurchase` now return `progress` for courses: the buyer's completed lessons that still exist, out of the course's current lessons. Read-only; the orders are already matched to the buyer's verified email, and lessons are read by the order's own store and product. No schema or index change.
- **Why:** founder request, 2026-11-04 (H6).

## D-069: Checkout with an order summary; a clearer thank-you page (H6b)
- **Date:** 2026-11-04
- **Decision:** both pages keep the creator's theme. **Checkout:** an order summary card (cover, title, "by <store>", regular price and discount when there is one, total) comes first on a phone and sits on the right, staying in view, on wide pages (`@3xl`); the form card is on the left with the creator's headline and "Sold by <store>. Payments are handled securely by the payment provider." The form keeps the app's own field colors on every theme. Its footer note now speaks to buyers ("Card details are entered on the payment provider's secure page, never here.") instead of mentioning Pickstall's fee. **Thank-you:** a status icon, the creator's message, the product, and for a paid order three numbered next steps (check your email, create your password if new, open your library) with an "Open your library" button; a pending order gets a Refresh button and a failed one "Try again".
- **Not changed:** the summary is information only (the server still computes the amount), the thank-you page still never grants access, order lookups are unchanged.
- **Why:** founder request, 2026-11-04 (H6).

## D-068: Product page redesign with a buy box (H6a)
- **Date:** 2026-11-04
- **Decision:** the public product page keeps the creator's theme and gets a clearer structure. At the top, a back link with the creator's photo and name (the full profile block at the bottom is gone). Then the cover, kind ("Course · 12 lessons" / "Digital product") and title; a **buy box** with the price, the Buy button, what the buyer gets (lessons and modules and access period for a course; email delivery and library for a digital product) and "Secure checkout. Sold by <store>."; then the description and course content. On a wide page (`@3xl`) the buy box sits on the right and stays in view while scrolling. On a phone, once the Buy button has scrolled away, a **buy bar** with the price and button slides up at the bottom (only when the store can take payments).
- **Not changed:** prices are still shown as information and recomputed at checkout; nothing private is on the page; no data or route changes.
- **Why:** founder request, 2026-11-04 (H6: redesign the buyer-side pages).

## D-067: Text fields use the card border plus a light fill
- **Date:** 2026-11-04
- **Decision (founder choice "card border + fill"):** text inputs, input groups, text areas, selects and code boxes use the light card border (`--line`) and a light gray fill (`--field-soft`), instead of the 3:1 gray border from D-059. On hover the border darkens (`--border-input`), on focus it turns blue with the soft glow, and errors stay red. Checkboxes and radios keep the D-059 border, because a small control needs a visible edge.
- **Trade-off (told to the founder):** the resting border no longer meets the WCAG 1.4.11 3:1 non-text contrast on its own; the fill, labels, hover and focus states carry it. Supersedes the field border part of D-059.
- **Why:** founder request, 2026-11-04 (fields should look as soft as the cards).

## D-066: Desktop layout for Clean, Bold and Soft (H5)
- **Date:** 2026-11-04
- **Decision:** the three original themes keep their phone look exactly. On a wide page (container `@3xl` and up) the page grows to about 1024px: the profile becomes a left-aligned banner (photo beside the name, bio and social links below, a thin rule under it) and the products form a grid of 2 cards, 3 on very wide pages (`@5xl`), with price and button lined up at the bottom of each card. Colors, borders, shadows and corners are unchanged. `StoreHeader` gains an `align="banner"` option; the product page header is unchanged.
- **Not changed:** no profile card around the banner, so the phone view stays identical.
- **Why:** founder request, 2026-11-04 (the old themes showed one narrow column on desktop).

## D-065: Neo-Brutalist and Frosted Glass themes (H4d)
- **Date:** 2026-11-04
- **Decision:** the last two of the six new themes, each with its own layout. **Neo-Brutalist** (`brutalist` layout): cream page, 3px ink borders, big hard "block" shadows, a loud accent band with the product count, uppercase headlines and a tilted price sticker on each cover; one, two or three columns by width. **Frosted Glass** (`glass` layout): a soft pastel gradient page with see-through, blurred cards (`backdrop-filter`), the profile in a centered card and the products in a grid below.
- **Theme engine:** presets may now set `pageGradient` (page background stops) and `glassOpacity` (how solid cards are); the shadow list gains `block`. Colors still live only in `lib/themes.ts`.
- **Contrast:** for gradient themes, text and muted colors are tested against every gradient color and against the glass card mixed over each of them, so text stays AA (4.5:1) wherever a card sits. Browsers without `backdrop-filter` still get the tinted card, so text stays readable.
- **Why:** founder request, 2026-11-04 (picked Neo-Brutalism and Glassmorphism).

## D-064: Editorial Luxury and Neon Bento themes (H4c)
- **Date:** 2026-11-04
- **Decision (founder's theme choice, D-062):**
  - **Editorial Luxury** (layout "editorial", serif headlines): cream paper (#FAF6EE), dark brown ink, a bronze accent (#7A4E24), sharp corners. A centered masthead between thin rules (store name in the serif, bio, social links), the first product as a wide "Featured" story, then "More from <store>" as a list with thin dividers, small covers and prices.
  - **Neon Bento** (layout "bento", dark): near-black page (#0B0B12), dark tiles, a cyan accent (#22D3EE) with dark-ink button text. The profile is the first tile, the first product a big tile, the rest fill a grid. Tiles glow in the creator's accent. Text always sits on the solid tile color, never on a picture.
  - All text pairs pass 4.5:1 (lowest 5.9:1). New card options: border "soft" (the theme's own text color at 14%, for dark themes) and shadow "glow" (two halos mixed from the accent), built from theme values, no new raw colors.
- **Why:** founder request, 2026-11-04.

## D-063: Studio and Academy themes (H4b)
- **Date:** 2026-11-04
- **Decision (founder's theme choice, D-062):** two new themes in the picker, each with its own layout:
  - **Studio** (layout "split"): warm off-white page, the profile in a panel that stays put beside a two-column grid of large product cards (cover, "Course · N lessons" or "Digital product", title, short description, price or Free, the creator's button). On a phone the panel comes first, then one card per row. Colors: background #FAFAF7, text #1C1B19, muted #625F57, accent #2F5D50.
  - **Academy** (layout "academy"): a course catalog. A wide header card with the profile and the real counts of courses and other products, category chips (each course's category, plus "Other products") that filter the cards (shadcn Toggle Group; all cards show without JavaScript), and course cards with category, lesson count and access period. Colors: background #F4F6FF, text #0F172A, muted #475569, accent #4F46E5.
  - Every text pair passes 4.5:1 (lowest 6.1:1, tested); the creator's own accent still goes through the same check.
- **Layouts size by the store frame, not the screen:** the frame is a CSS container (`@container`) and the new layouts use container breakpoints, so the dashboard's scaled preview shows the true phone or desktop layout.
- **Public data:** public course data now includes `lessonCount` (only a count per course of that store; lesson content never leaves the server). The dashboard preview uses the same count.
- **Landing page:** its theme demos keep the three classic themes (`CLASSIC_THEME_IDS`); they draw only that layout.
- **Not yet:** the product, checkout and thank-you pages keep their single column in every theme (H6).
- **Why:** founder request, 2026-11-04.

## D-062: Store themes get layouts; one live preview on My Store (H4a)
- **Date:** 2026-11-04
- **Decision (founder request; 6 new themes chosen: Studio, Editorial Luxury, Neon Bento, Academy, Neo-Brutalist, Frosted Glass; Clean, Bold and Soft stay):** a theme is now a layout plus a style, not only colors. `ThemePreset` gains `layout` (`STORE_LAYOUTS`) and `displayFont` ("sans" or "serif"). `StorePage` draws the theme's layout from a registry (`components/store/layouts/*`); the original page is the "stack" layout used by Clean, Bold and Soft, unchanged. New themes add a preset, a layout component and a picker sketch (H4b-H4d).
- **Serif:** Fraunces through `next/font/google` (self-hosted at build time, like the app's fonts, `preload: false` so stores on other themes never fetch it). A serif theme points `--font-bricolage` (behind `font-display`) at it on its own page only. Approved by the founder.
- **One preview:** the Page design tab no longer has its own phone preview. The Store preview on the right of My Store is the only preview: it renders the real `StorePage` (not a copy) at phone or desktop width, scaled to fit, inert so links do not navigate, with "Expand preview" for a large view. While Page design is being edited it shows the unsaved theme and accent ("Unsaved changes"), through a small client context (`DesignDraftProvider`); a good save makes them the saved ones. `StoreFrame` has a preview mode without a page height or a second `<main>`. The theme picker shows a sketch of each theme's layout in its colors.
- **Not changed:** the setup wizard keeps its phone preview for now; buyer-facing data and its safety rules are the same in every layout (public fields only, no raw HTML).
- **Why:** founder request, 2026-11-04.

## D-061: Live notifications in the dashboard bell
- **Date:** 2026-11-04
- **Decision (founder choices: new sale, refund, video ready/failed, browser pop-up):** the dashboard bell shows the store's latest 20 notifications with an unread count; opening it marks them read. It checks every 20 seconds while the dashboard is visible, every minute in a hidden tab, and right away when the tab comes back. With the creator's permission ("Turn on" in the bell), news that arrives while the tab is hidden also shows as a desktop pop-up (Notification API); clicking it opens the order or course.
- **What makes one:** an order becoming paid ("New sale: $49.00 / Maya bought ..."; a free order is "New sign-up"; mock orders carry a Test badge), a refund that raised the refunded amount ("Partly refunded" / "Refunded"), and a lesson video turning ready or failed (from the Bunny webhook or the builder's status check).
- **Safety:** notifications live in a new `notifications` collection with a unique `dedupeKey` (`sale:<order>`, `refund:<order>:<amount>`, `video:<id>:<status>`), so a replayed webhook never adds a second one; a TTL index removes them after 90 days. Writing one never throws and never changes the payment: it runs after the order update in `onOrderPaid` (shared by Stripe, the dev mock and free orders) and after a refund that changed the order. Reads and "mark read" filter by the session's store; links are dashboard paths only.
- **Not in this change:** email or phone push notifications, per-type settings, a full notifications page.
- **Why:** founder request, 2026-11-04.

## D-060: Smoother course building: new lessons open at once, video upload on each lesson row
- **Date:** 2026-11-04
- **Decision (founder: "too many clicks per lesson", "video upload is hidden"):** "Add lesson" now opens the new lesson's editor straight away. Each lesson row has an **Upload video** button (Replace when it already has one) and accepts a video **dropped onto the row** from the computer (a lesson being dragged to reorder is a pointer drag and does not trigger it); the row shows the upload progress, or the error with Dismiss. Uploads are held by the builder (`useVideoUploads`), so the row and the lesson panel show the same upload, the panel can be closed while it runs, and the browser asks before leaving the page during an upload. Only video files start an upload (MP4, MOV, WebM, MKV, M4V, AVI). Upload buttons appear only when Bunny is set up (D-058).
- **Why:** founder request, 2026-11-04.

## D-059: Softer form fields; Edit and Delete for published products
- **Date:** 2026-11-04
- **Decision (founder request; choices "soft but accessible" and "hide, keep buyer access"):**
  - **Fields:** text inputs, text areas, selects, input groups, the code boxes, checkboxes and radios use a softer border token `--border-field` (#8b91a7: 3.1:1 on white, 3.05:1 on the new faint fill `--field`, so DESIGN.md's 3:1 rule still holds), a hairline `shadow-field`, a slightly darker border on hover, and on focus a blue border with a soft 4px glow (`--focus-glow`) instead of the hard 3px outline. Buttons keep `--border-input`. The fill is the Tailwind color `input-fill`, not `field`, because `text-field` is already a font size.
  - **Product actions:** every product row has a "..." menu: Edit, View on store (published), Publish or Unpublish (same server rules as the editor), Delete (asks first). The editors show Delete on published products too.
  - **Delete:** a product (or course) without any order is removed for good, with its files, lessons and Bunny videos. One with orders is hidden instead: `deletedAt` is set, it is archived and its link freed, so it leaves the store, the product list and the editor, while its buyers keep their library access (downloads, links and the course player) and the creator keeps the orders. Every creator-side product and course query skips hidden products; the buyer library and course player deliberately do not.
- **Also fixed:** after commit d4ebfeb, a failed "Save and publish" left the publish request on, so a later plain Save could publish; the request is now cleared on every save result. Removed a console.error from the video upload and an unused import (lint).
- **Data:** `ProductDoc.deletedAt` (optional). No migration: missing means not deleted.
- **Why:** founder request, 2026-11-04.

## D-058: Bunny video upload works with the library id and API key; status is checked with Bunny
- **Date:** 2026-11-04
- **Decision (founder connected the Bunny library):** video upload now turns on with just `BUNNY_STREAM_LIBRARY_ID` and `BUNNY_STREAM_API_KEY` (checked against Bunny's API: it answers 200). The other two keys are needed only for their own jobs: `BUNNY_STREAM_TOKEN_KEY` signs playback links and is **required in production** (without it a Bunny video shows as unavailable there; in development it plays unsigned, so token authentication must stay off in Bunny until the key is set), and `BUNNY_STREAM_READONLY_KEY` verifies the webhook (without it the webhook accepts nothing).
- **Status without the webhook:** Bunny cannot call localhost, so while the curriculum builder waits it asks Bunny's Get Video API about this course's videos still uploading or processing (at most 10 per check) and saves the result. Get Video numbers its states differently from the webhook (bunny.net/docs/reference/video_getvideo, checked 2026-11-04): 4 Finished = ready, 5 Error and 6 UploadFailed = failed, 1/2/3/7/8 = processing, 0 Created = no change. A late "processing" still never undoes "ready".
- **Secrets:** the values live only in `.env.local`, which git ignores.
- **Why:** founder request, 2026-11-04.

## D-057: Courses (part G4): the student view, progress and lesson downloads
- **Date:** 2026-11-04
- **Decision (founder spec "student view"):** a bought course opens from the buyer library ("Open course") at `/library/[orderId]/learn`: the lessons on the left (below the lesson on phones), the video player and the lesson on the right, a **Mark as complete** button, and a progress bar with the completion %. Without a lesson chosen it opens the first open lesson not done yet. The library lists a course with a "Course" badge, its access period ("Lifetime access" or "Access until ...") and "Access ended" when it is over.
- **Access (checked on every page load, download and progress change, `lib/courses/student.ts`):** the order belongs to the signed-in, verified email; it is paid (a refund removes access; a partly refunded order stays paid, D-053); the product is a course of the order's own store; the access period, counted from the payment, has not ended. A lesson in a module that drip has not opened cannot be shown, downloaded or marked, whatever the URL says (the same `buildOutline` rule as the preview). Bunny videos play through the one-hour signed link of D-056.
- **Progress:** a new `lessonProgress` collection, one document per order and lesson (`_id` "orderId:lessonId", so marking twice is one document), read by order. "Mark as complete" toggles it after the checks above.
- **Lesson files:** `/library/[orderId]/files/[fileId]` streams the file from private storage as an attachment (no-store, nosniff, sandbox CSP), only for a file of an open lesson of the student's course.
- **Fix found on the way (D-050 follow-up):** the library marked a product "available" only when it had a link, so products delivered as an uploaded file showed "Unavailable". It now uses the same `hasDelivery` rule as publishing.
- **Not in this change:** course completion emails or certificates, quizzes, comments; a student account page beyond the library. Real payments come with the Stripe branch (D-053).
- **Why:** founder request, 2026-11-04.

## D-056: Courses (part G3): drip, student preview, publishing and the public course page
- **Date:** 2026-11-04
- **Decision (founder spec step 4, founder choice of drip by days after purchase):** Step 4 of the course editor holds **How lessons open**: All at once, or Drip, where each module opens a set day after the student's purchase (day 0 = right away, up to 365; saved with `saveCourseRelease`, checked on the server, written only to this store's course and modules). The rule lives in one pure file, `lib/courses/drip.ts`, which the student view (G4) uses too. Saving steps 1–2 now writes dotted course fields, so it never resets the drip setting.
- **Publishing:** a course can be published when it has a title, at least one lesson with something for students (a video, notes, a file or a link) and, if it is paid, payments connected. The same `publishProblems` runs in the editor's checklist and on the server (`changeProductStatus` counts the course's lessons with the store filter). "Save and publish" saves steps 1–2 first, then publishes; "Unpublish" puts it back to draft. Videos still processing do not block publishing; students see "still being processed".
- **Student preview:** `/dashboard/products/[id]/preview` shows the real course player with every module open (drip days as labels): lesson list, video, notes, files and links, previous and next. Bunny videos play through a signed player link that expires after one hour, made only when the video is ready; YouTube and Vimeo play from embed links built from their ids. The page CSP now allows frames from exactly `player.mediadelivery.net`, `www.youtube-nocookie.com` and `player.vimeo.com` (still `frame-ancestors 'none'`).
- **Public course page:** a published course shows "Course content": module and lesson titles, a video icon, the lesson count and the access period. `findPublicCurriculum` reads only titles and whether a lesson has a video, and only for a published course of a published store; lesson content, video ids, files and links never leave the server. A free course shows "Free".
- **Known gap until G4:** a student who buys a published course sees it in their library but cannot open the lessons yet; the student view, progress and "Mark as complete" are G4. Real payments also wait for the Stripe branch (D-053).
- **Why:** founder request, 2026-11-04.

## D-055: Courses (part G2): curriculum builder, Bunny.net Stream video, YouTube/Vimeo, lesson files and links
- **Date:** 2026-11-04
- **Decision (founder spec, founder choice of Bunny.net + YouTube/Vimeo and dnd-kit):** Step 3 of the course editor is a curriculum builder. Modules are an accordion; lessons sit inside. Modules and lessons reorder by dragging (dnd-kit, mouse, touch or keyboard) or with up/down buttons, and lessons can be dragged into another module; every change saves at once. A lesson opens in a side sheet: title, **video** (Upload to Bunny, a YouTube/Vimeo link, or none), **notes** (rich text, up to 10,000 characters), **files** (up to 5, same types and 200 MB limit as product files) and **links** (up to 5, https only, for Figma files and the like). Limits: 50 modules, 300 lessons per course.
- **Video, per the Bunny docs (checked 2026-11-04):** the server creates the video in the creator's library and signs a TUS upload (SHA256 of library id + API key + expiry + video id, valid 24 hours); the browser uploads straight to Bunny with `tus-js-client`, so the API key never leaves the server. The Bunny webhook (`/api/webhooks/bunny`) is checked with HMAC-SHA256 of the raw body (the library's read-only key), recorded in `webhookEvents` before any work (a redelivery does nothing), and moves the lesson's video to processing, ready or failed; a late "processing" never undoes "ready". Signed player links (token + expiry) are built for G4. YouTube/Vimeo links keep only the video id (and Vimeo's privacy hash); the embed URL is always rebuilt from the id (youtube-nocookie, player.vimeo.com). The Bunny video id is never sent to the browser.
- **Data:** new collections `courseModules` and `lessons` (indexes on store + course + order, and on the Bunny video id for the webhook); lesson files are `files` documents with a `lessonId`. Every curriculum query filters by the session's store id and the course id, and the course must be a course of that store; a layout save must name exactly the course's own modules and lessons. Deleting a lesson, module or course removes its files and Bunny videos (a Bunny failure only leaves a video in the library).
- **Config:** `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY`, `BUNNY_STREAM_READONLY_KEY` replace the Mux names in `.env.example`, `CLAUDE.md` and the PRD. Without them, upload is off and links still work. New dependencies (founder approved): `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `tus-js-client`.
- **Security note found while doing this:** `.env.example` held a real-looking Resend API key (committed 2026-10-29, pushed). It is blanked here; the key must be revoked in Resend, since git history keeps it.
- **Not yet:** publishing a course, drip settings and the student preview (G3), the student view and playback (G4).
- **Why:** founder request, 2026-11-04.

## D-054: Courses (part G1): a course is a product type, with Basic and Pricing steps
- **Date:** 2026-11-04
- **Decision (founder spec "course add flow", 2026-11-04):** a course is a product with `type: "course"`, so it shares the store page, checkout, orders and buyer library with digital products; buying a course is a paid (or free) order, and the payment code (Block D, D-053) needs nothing course-specific. Founder choices: videos on **Bunny.net Stream** plus YouTube/Vimeo links (replacing Mux in the PRD; the stack docs change with G2), the course "duration" is an **access period** (lifetime or 1–3650 days from purchase), drip unlocks modules **N days after purchase**, and drag-and-drop uses **dnd-kit** (added in G2).
- **G1 (this change):** "Course" is now selectable on New product and opens a four-step course editor: **1 Basic info** (title, rich description, cover image, one category from a fixed list, up to 5 tags), **2 Pricing** (Paid or Free; a paid course needs a price above 0 and can have a discount, checked like a product's; access Lifetime or Limited days), **3 Curriculum** and **4 Publish** (placeholders until G2/G3; Publish lists what is missing and can delete a draft). A course cannot be published yet: the publish rule asks for lessons, so it cannot reach the store or checkout before G3.
- **Data:** `ProductDoc.type` is `"digital" | "course"`, with `course: { category, tags, accessDays }` on courses. No migration (existing products stay `digital`). Course writes (`updateCourseDetails`) filter by the session's store id and `type: "course"`; the digital editor's `updateProduct` and the file upload now skip courses. The slug logic is shared (`saveWithSlug`), as are the discount check (`discountProblem`) and the editor's `Field` / `MoneyInput` / `StepHeading` (`components/dashboard/editor-fields.tsx`). Tests: unit (input rules in USD and JPY, steps, publish rule, actions, ownership filters) and a cross-tenant integration test.
- **Next:** G2 curriculum builder (modules, lessons, Bunny upload, YouTube/Vimeo, attachments, notes, dnd-kit), G3 drip/preview/publish, G4 student view.
- **Why:** founder request, 2026-11-04.
## D-053: Block D: real Stripe Connect payments, refunds from the order drawer
- **Date:** 2026-11-04
- **Decision (founder approved the plan and the recommended answers):**
  - **Connect OAuth (Standard accounts):** "Connect Stripe" in the setup wizard and Settings > Payments opens `connect.stripe.com/oauth/authorize` (`scope=read_write`, `state`, our fixed `redirect_uri`). The callback `/api/connect/stripe/callback` checks the state, exchanges the code with `oauth.token` once and saves `stripe_user_id` on the signed-in user's own store with its `charges_enabled`, `payouts_enabled`, `details_submitted` and `livemode`. An account in the other mode than our key is refused. Checked against docs.stripe.com/connect/oauth-reference on 2026-11-04; availability of OAuth for a new India platform and live mode still need Stripe's confirmation.
  - **State:** a random 32-byte value in the new `connectStates` collection (TTL index, 10 minutes), bound to the user, deleted BEFORE the code is exchanged (Stripe revokes a connection whose code is used twice). The creator lands on one of two fixed pages with `?stripe=connected|cancelled|expired|wrong_mode|error`.
  - **Disconnect (founder choice: follow PRD 5.6 A):** the store's account is cleared, its paid products go back to draft (free products stay), and `oauth.deauthorize` is called unless another store still uses the account. The same happens on `account.application.deauthorized`. A confirmation dialog says so first.
  - **Test seller shortcut kept (founder choice):** in test mode "Use test Stripe account" (D-034) stays as a second button. Its events are our own account's, so they arrive on a new **platform** endpoint `/api/webhooks/stripe` with its own secret `STRIPE_PLATFORM_WEBHOOK_SECRET`; the Connect endpoint keeps `STRIPE_CONNECT_WEBHOOK_SECRET`.
  - **Webhooks:** `checkout.session.completed` (only when `payment_status` is `paid`) and `checkout.session.async_payment_succeeded` mark the order paid; `async_payment_failed` and `checkout.session.expired` mark a pending order failed; `charge.refunded` records `amountRefundedCents` and, when `refunded` is true, marks the order refunded (a partial refund keeps access); `account.updated` refreshes the store's status. Every order event must come from the order's store account (`event.account`), in our key's mode, for our own session id and amount. Idempotency is unchanged (event id inserted first). Checkout sessions now expire after 60 minutes and carry the order id on the PaymentIntent.
  - **Refund button:** the order drawer has "Refund" for paid provider orders (confirm dialog). It calls `refunds.create` on the creator's account with an idempotency key per order; the order turns refunded only when the verified `charge.refunded` event arrives, so refunds from the drawer and from the Stripe Dashboard take one path. Rate limited per creator.
  - **Payment methods and currencies:** no `payment_method_types`; with direct charges the connected account's own payment method settings decide what buyers see. Amounts stay in Stripe's units for any currency (D-046).
  - **Fulfilment hook:** `onOrderPaid` in `lib/payments/process.ts` is the one place to add per-kind fulfilment (courses: an idempotent enrollment keyed by order id).
- **Schema (founder approved, no migration):** optional store fields `stripePayoutsEnabled`, `stripeDetailsSubmitted`, `stripeLivemode`, `stripeConnectedAt`; optional order fields `refundRequestedAt`, `refundedAt`, `amountRefundedCents`; new `connectStates` collection; indexes `connect_states_ttl` and `stores_stripe_account`.
- **Env:** `STRIPE_CONNECT_CLIENT_ID` and `STRIPE_PLATFORM_WEBHOOK_SECRET` are now read. Register `<APP_URL>/api/connect/stripe/callback` as a redirect URI in Stripe Dashboard > Connect > Onboarding options > OAuth.
- **Not done:** disputes (`charge.dispute.*`), a failed refund (`refund.failed`) clearing "Refund requested", saving the seller account on each order (a refund after the creator switched Stripe accounts fails and must be done in the Stripe Dashboard).
- **Why:** PRD section 2, F4, 5.6 A to C; founder backlog block D.

## D-052: Every UI control comes from shadcn/ui
- **Date:** 2026-11-04
- **Decision (founder request "aapda platform ma 21st.dev ane shadcn sivay na koi component use na thava joye"):** all controls are shadcn/ui components in `components/ui`, restyled to the DESIGN tokens; screens no longer hand-build buttons, inputs, checkboxes, radios, toggles or accordions. **E1:** Field, Empty, Input Group, Native Select and Spinner from shadcn; FormField, EmptyState, IconInput and Select keep their props and are built from them; the other primitives already followed shadcn (cva, Radix, `data-slot`). **E2:** new Checkbox, Radio Group, Toggle, Toggle Group (the DESIGN 9.3 segmented control), Accordion, Avatar, Input OTP, Tooltip and Kbd. **E3:** the remaining raw controls moved to Button, Input Group, Toggle Group, Switch and a new Slider. The only raw inputs left are hidden ones (form values, and file pickers opened by a Button).
- **New dependency (founder approved):** `input-otp` 1.5, which shadcn's Input OTP is built on; the login code box now uses it (paste, one-time-code autofill and arrow keys come from the package; pasted text is still cleaned to digits). The old per-box helpers were removed. Everything else uses the existing `radix-ui` package.
- **Not in this change (founder choice):** the dashboard sidebar moves to shadcn Sidebar later, as its own task. 21st.dev was not needed: shadcn had a component for every control.
- **Why:** founder request, 2026-11-03.

## D-051: Orders and Customers as tables with a details drawer
- **Date:** 2026-11-03
- **Decision (founder request "Orders, customer page ni UI ekdam simple che, tene proper karvani che"):** both pages follow DESIGN 9.9 and 10.2. **Orders:** status tabs with counts, search, a product filter, Export CSV (the current filters, with a Status column), and a table (Date, Order number, Customer, Product, Status, Amount); on phones each row is a card. A row opens a right-side drawer (bottom sheet on phones) with the amount, payment breakdown (price, discount, total, paid with, paid on), customer contact with Copy email, downloads used against the limit, the checkout answers and "View customer". **Customers:** search, product filter, Export CSV, and a table (Customer, Products bought, Answers, Last order, Total spent) with "Load more"; the drawer shows totals, contact, and every order with its answers and an "Open order" link. Refunded is now a red badge (DESIGN 9.5).
- **How:** the drawers open from the URL (`?order=` / `?customer=`), so they can be linked and Back closes them; the server renders them. A customer is opened and paged by one of their order ids, never by email, so no email goes into a URL or server log. New `/lib` queries `findOrderDetail`, `findCustomerDetail`, `listOrdersForExport` and a product filter and cursor on `listCustomers`, all filtered by the session's store id, with ownership tests (unit and cross-tenant). New shadcn `Sheet` and `Table` components on the existing `radix-ui` package (no new dependency). CSV amounts now use the currency's own decimals (a JPY 500 sale was exported as 5.00).
- **Not in this change (founder choice):** customer notes and tags (need a new collection; later) and a refund button (with the Stripe session).
- **Why:** founder request, 2026-11-03.

## D-050: Product delivery is an uploaded file or a redirect link; files on private disk storage
- **Date:** 2026-11-03
- **Decision (founder request, storage choice "disk only for now"):** the Details step asks "How buyers get it": **Upload file** or **Redirect to URL**. `products.deliveryType` (`"link"` or `"file"`, missing = link for older products) and `products.fileId` record the choice; a product publishes only when the chosen one is there (`hasDelivery` in lib/products/publish.ts, used by the server and the editor checklist).
- **Upload:** `PUT /api/products/[id]/file` takes the raw file (name in `X-File-Name`), only for the signed-in creator's own product (store id from the session), rate limited (20 per 10 minutes), at most 200 MB (`PRODUCT_FILE_MAX_BYTES`), checked from Content-Length first and again while streaming, so a file is never held in memory. Allowed types: PDF, ZIP, EPUB, Word, Excel, CSV, PNG, JPG, MP3, MP4; the extension AND the first bytes must match, and the stored type comes from our table, never from the browser. The shown name is cleaned (no path, control or reserved characters, 120 characters). `DELETE` removes it and goes back to link delivery. Replacing a file removes the old one; deleting a product removes its files. The editor shows upload progress, then the name, type and size with Replace and Remove.
- **Storage:** a new `files` collection (`FileDoc`: store id, product id, uuid key, name, ext, mime, size; index on store and product) and a private folder on the server's disk, `PRODUCT_FILES_DIR` (default `.data/product-files`), separate from the public images. Files are never served by path.
- **Buyer download:** through the existing library link (`/library/[orderId]/open`) after the same checks as links (the buyer's own paid order, not refunded, download limit counted atomically, file still present). The file is streamed by the server with `Content-Disposition: attachment`, `no-store`, `nosniff` and a sandbox CSP, instead of a separate 60-second signed link: the checked request itself is the short-lived access, and nothing is left that can be shared.
- **Limits of this choice:** disk storage needs one server with a persistent disk; serverless hosting or several servers need a private bucket with signed URLs (PRD F3b), to decide before deploy. No virus scanning yet.
- **Why:** founder request, 2026-11-03.

## D-049: Rich text product descriptions (Tiptap), stored as allow-listed JSON
- **Date:** 2026-11-03
- **Decision (founder request and choice of Tiptap):** the Details step has a text editor for the description: bold, italic, underline, two heading sizes, bullet and numbered lists, links, undo and redo, with a character count. New dependencies (founder approved): `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm` 3.32.2; StarterKit 3 already includes Link and Underline, so no separate link package.
- **Storage and safety:** the editor's ProseMirror JSON is stored as `products.descriptionDoc`, checked by `richDocSchema` (lib/products/rich-text.ts): only doc, paragraph, heading 2/3, bullet and numbered lists, list items, hard breaks and text; only bold, italic, underline and link marks; links https or mailto with no credentials, and only the address is kept; text cleaned like all creator text; at most 2000 characters, 600 nodes and 6 levels; empty paragraphs at the start and end are dropped. Unknown nodes or marks fail the save instead of being passed through. `description` keeps the plain text, made on the server from the checked document. Nothing is stored or rendered as HTML: `RichTextView` builds React elements node by node and checks links again (target _blank, rel noopener noreferrer nofollow ugc).
- **Old products:** a plain description opens in the editor as paragraphs and still shows as before until saved. No migration needed.
- **Fixes found in the browser:** toolbar buttons keep the editor's selection (mousedown does not take focus), and the editor no longer adds an empty paragraph at the end.
- **Follow-up, not from this change:** in development, Next.js flags `new Date()` during prerender of the public product page, raised inside the database connection code; to look at separately.
- **Why:** founder request, 2026-11-03.

## D-048: Product editor in three steps; save and publish in one step
- **Date:** 2026-11-03
- **Decision (founder request):** the product editor works like Stan's, one step at a time: **1 Details** (title, description, cover, delivery link, price and discount, button text), **2 Checkout form** (headline; Name and Email shown as locked "Always asked" rows, a Phone switch, and up to 5 extra fields), **3 Publish** (a "Ready to publish / Before you publish" check, after-purchase message and email, and "More settings": product link, download limit, archive, delete). A stepper on top shows each step as done, in progress or to do; on phones it shows short names.
- **Saving:** "Save and continue" saves and opens the next step; "Back" and the stepper move freely; "Save" on top saves without moving. "Save and publish" sends `intent=publish`: `saveProduct` saves, then checks the publish rules on the product as just saved and publishes, so nothing typed is lost and the rules are always the server's. If a rule fails, the save stands and the problems come back. The Publish step's checklist uses the same `publishProblems` the server uses.
- **Fix:** the editor submits through `onSubmit` instead of `action={...}`. React resets a form after an action and the Radix switches followed that reset back to their first value, so the discount (D-047) and phone switches turned themselves off after every save.
- **Supersedes:** the four editor tabs of PRD F3.
- **Why:** founder request, 2026-11-03.

## D-047: Price with an optional discount; pay-what-you-want removed
- **Date:** 2026-11-03
- **Decision (founder request):** a product has a price and, behind a "Add a discount" switch, a discounted price buyers pay instead. The store, product page, checkout, preview and product list show the discounted price with the regular one struck through (`PriceTag`; screen readers hear "was $29.00"). Pay-what-you-want is gone: no price type choice in the editor, no amount field at checkout.
- **Rules:** the discounted price must be lower than the price, above 0, and within Stripe's limits for the store currency (D-046); a free product cannot have one. The server computes every amount from the product (`orderAmounts`): `subtotalCents` = price, `discountCents` = price minus discounted price, `totalCents` = what the buyer pays and what Stripe charges. Nothing the buyer sends changes it.
- **Data:** products get `salePriceCents` (null without a discount); `pricingModel` and `minPriceCents` are no longer written. A product saved before this sells at its `priceCents` (its old suggested price), so the app is correct before and after `scripts/migrations/2026-11-remove-pwyw.mjs` (dry run by default, `--apply` to write, safe to repeat; tested on a throwaway database). Saving a product in the editor also clears the old fields. Founder decision: old pay-what-you-want products become fixed at their suggested price.
- **Supersedes:** the pay-what-you-want lines in PRD F3 and F4.
- **Follow-up:** the landing page branch (D-043) still mentions pay what you want; update its copy when merging.
- **Why:** founder request, 2026-11-03.

## D-046: Every Stripe currency, currency lock, social links from usernames
- **Date:** 2026-11-03
- **Currencies:** stores can pick any of the 134 presentment currencies Stripe lists for US, UK and Canadian accounts (docs.stripe.com/currencies, checked 2026-11-03), in a searchable picker with flags (euro: EU flag; shared currencies such as XOF: a globe). Names come from `Intl.DisplayNames`.
- **Money units:** amounts are integers in the units Stripe expects: cents for two-decimal currencies, whole units for Stripe's zero-decimal list (BIF, CLP, DJF, GNF, JPY, KMF, KRW, MGA, PYG, RWF, VND, VUV, XAF, XOF, XPF), and whole units times 100 for Stripe's special cases ISK and UGX (no fractions). `parseMoneyToCents`, `centsToInput` and `formatMoney` now take the currency. Stored `...Cents` fields keep their names and mean "Stripe amount units".
- **Price limits (founder decision):** the minimum paid price is Stripe's minimum charge where Stripe lists one (USD 0.50, GBP 0.30, JPY 50, ...), else one whole unit; the maximum is Stripe's 8-digit limit. This replaces the old USD 1.00 to 500 limits. Stripe still checks its own minimum when a checkout is created.
- **Currency lock (founder decision):** the currency cannot change once the store has any product (archived ones too), checked on the server in `saveStoreSetup`; the picker shows it locked with the reason. Existing stores keep their currency.
- **Social links (founder decision):** one fixed row per platform (Instagram, TikTok, Facebook, X, LinkedIn, YouTube, Email) plus Website kept as an extra row. The creator types a username; we build the link (a pasted profile link is read back to its username). Format rules from each platform's help center where it could be read (X, YouTube, Facebook, LinkedIn); Instagram and TikTok get a lenient check. It cannot check that an account exists. Email is stored as `mailto:`; everything else stays https only. Links are still stored as `{kind, url}`: no migration. One link per platform; stores with two links of one kind keep both until the creator saves the form, which keeps the first.
- **Logos (founder decision):** brand logos copied from Simple Icons (CC0), LinkedIn from v13.0.0 because later versions dropped it; no new dependency. DESIGN.md 8 has the exception.
- **Why:** founder request, 2026-11-03.

## D-045: Store setup wizard; My Store waits for setup
- **Date:** 2026-11-03
- **Decision:**
  - New page `/dashboard/setup` runs the four first-run steps one at a time (Store, First product, Connect payments, Publish) under a stepper that shows what is done and what is left. Without `?step` it opens the next step to do, so finishing a step opens the next one. Step 1 is the store form in a "setup" mode: theme and accent are picked there too (shared `ThemeFields`, same rules as Page design, saved by `saveStoreSetup` only when the form sends them), with a live "Your store so far" summary.
  - Step state still comes from the store's data (photo or bio; product count; Stripe connected; published): no schema change.
  - Payments (founder decision): the step is real and required now, using the test-mode seller account (D-034). On a server that cannot connect Stripe at all (no test key, for example the sandbox) the step shows but does not block setup. When Connect OAuth arrives it plugs into `paymentsConnectable()` and the flow stays the same.
  - My Store shows only the greeting and the setup checklist until setup is complete; after that the KPIs, tabs and store preview, without the "Get started" and store-link cards. Copy link and Publish/Unpublish moved to Settings > Store ("Store status"). Other dashboard pages show a "Continue setup" bar while setup is open.
  - The store preview is a proper phone frame that shows the creator's real products (published only where it says "what buyers see"), priced with the store page's own `priceLabel`.
- **Why:** founder request, 2026-11-03.

## D-044: Part A quick fixes (signup checks, full-width dashboard, store name, saved messages)
- **Date:** 2026-11-03
- **Decision:**
  - Signup email gets a live format check (green check / red message), using the same `emailSchema` as the server (`lib/auth/email-format.ts`). Format only: it never looks up accounts, so it cannot reveal whether an email is registered. The username check was tested and already worked (free = green, taken or reserved = red).
  - The dashboard content no longer stops at 1440px; it uses the full width next to the sidebar (DESIGN.md 5 updated).
  - A new store is named after the signup username, made readable (`maya-books` -> "Maya Books", `lib/stores/store-name.ts`), instead of the creator's full name. Both signup paths (email and Google) go through `createDraftStore`, which now derives the name itself.
  - Success messages ("Your store is saved.", "Page design saved.", "Your account is saved.", product saved/published, username changed) hide themselves after 5 seconds (`useAutoHide`). Error messages stay until the next action.
- **Why:** founder request, 2026-11-03 (store name = username, confirmed in chat).

## D-043: Landing page redesign (premium SaaS layout, same brand)
- **Date:** 2026-11-03
- **Decision:** the marketing landing is rebuilt as a product tour: hero with the "Build your stall" demo in a wide frame, an honest proof strip, a bento features grid, interactive Storefront (real theme presets via `resolveTheme`), Product management, Checkout and Analytics showcases, Pricing (planned prices from `PLANNED_PRICE_CENTS`, founding plan featured, fee calculator), the Stan Store comparison, Founding creators, FAQ and the claim-link CTA. Colors, fonts and the stall motifs (awning, receipt, coupon, hard shadows) are unchanged.
- **Dependency:** `motion` (approved by the founder, 2026-11-03), loaded through `LazyMotion` with `domAnimation` only. Content renders visible on the server; scroll entrances arm themselves only below the fold, so the page reads fine without JavaScript and under reduced motion.
- **Honesty:** no testimonials, logos or user counts exist yet, so "Social proof" is a strip of true facts about money and access, and "Testimonials" is the Founding creators section with a note that quotes will appear only once they are real (DESIGN.md 2.5, 17).
- **Additions:** `bg-dots`, `mask-fade-b` and `mask-fade-y` utilities (pattern and mask only, no color gradients), marketing only.
- **Why:** founder request, 2026-11-03.

## D-042: The app recovers from a MongoDB outage without a restart
- **Date:** 2026-11-01
- **Problem (founder report):** signup from Antigravity showed "Couldn't check that username. Try again." The dev log showed `MongoServerSelectionError` (this PC could not reach Atlas; DNS and TCP were fine, so most likely Atlas Network Access does not list the PC's current IP), then `MongoTopologyClosedError` on every later request. The MongoDB driver (7.x) closes the topology after a failed connect but keeps it on the client; its automatic connect never replaces it, so the app stayed broken until restarted, even after the network was fixed.
- **Decision:**
  - `getDb()` calls `mongoClient.connect()` explicitly (`ensureConnected`), which opens a new topology after a failure and costs nothing when connected. The session guard starts the same repair without waiting, so Better Auth's queries heal too. Server selection timeout is 10 s instead of 30 s. Integration test `tests/integration/reconnect.test.ts` fails without the fix (MongoTopologyClosedError) and passes with it.
  - In development the username check now says what is wrong and how to fix it (`lib/db/errors.ts`: Atlas IP, wrong password, DNS, missing `.env.local`); production keeps the generic message.
- **Founder action:** in MongoDB Atlas > Network Access, add this PC's current IP (home IPs change), or run `pnpm doctor` to confirm.
- **Why:** founder report, 2026-11-01.

## D-041: The dev server works from any PC, IDE preview or device
- **Date:** 2026-11-01
- **Problem (founder report):** opened from Antigravity or another PC, the app loaded but typing in inputs failed with errors. Cause, reproduced: Next.js 16 serves its dev resources (scripts, hot reload) only to `localhost`, so `127.0.0.1` (IDE previews) and LAN addresses got 403 and the page broke. Login and redirects were also tied to `NEXT_PUBLIC_APP_URL` (`localhost`), which on another PC points to that PC itself.
- **Decision:**
  - `allowedDevOrigins` in `next.config.ts` from `lib/dev-hosts.ts`: `127.0.0.1`, `[::1]`, the private IPv4 ranges, `*.local`, this PC's name and `DEV_ALLOWED_HOSTS`. Only `next dev` uses it; other sites are still blocked (checked: 403).
  - In development only, links and redirects follow the local or LAN address the request came in on (`lib/app-origin.ts`): Google callback redirect, the library "open" same-origin check, Stripe success and cancel URLs, and Better Auth's trusted origins. Production keeps using `NEXT_PUBLIC_APP_URL` alone and never trusts the Host header (unit-tested).
  - Cross-Origin-Opener-Policy is sent in production only (browsers ignore it on plain http and log an error).
  - `pnpm doctor` checks a new PC: Node 20.9+, dependencies, `.env.local` and its required values, and a MongoDB ping, with plain fixes for the usual failures (Atlas IP access list, DNS that cannot resolve `mongodb+srv`). `engines.node` is `>=20.9`.
- **Verified:** sign-up with the email code from `http://192.168.1.22` (LAN) reaching the dashboard, and typing plus the hero demo from `http://127.0.0.1`, both without console errors.
- **Why:** founder request, 2026-11-01.

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
