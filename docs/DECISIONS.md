# Decisions log

Short records of product and engineering decisions. Newest first. Each entry: date, decision, why, consequences. Do not edit past entries; add a new one that supersedes them.

---

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
