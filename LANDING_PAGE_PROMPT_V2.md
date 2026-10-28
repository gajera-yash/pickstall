# Prompt V2 for Claude Code: Pickstall landing page (modern, creative, interactive)

> This replaces `LANDING_PAGE_PROMPT.md` (keep that file only for its copy and honesty rules). Put `PRD.md`, `CLAUDE.md`, `DESIGN.md` and this file in the repo root, open Claude Code, and paste everything below the line. Optional: attach screenshots from your ChatGPT image generations as visual references and say "match this art direction".

---

You are an award-level product designer and senior front-end engineer. Read `CLAUDE.md`, `DESIGN.md` and `PRD.md` first. `DESIGN.md` is the source of truth for tokens, type, components and accessibility. This prompt adds creative direction for the marketing page and the few explicit additions listed in section 3. Where they conflict, `DESIGN.md` wins unless section 3 says otherwise.

Do not write code yet. First reply with: (a) a 10-line summary of the creative concept in your own words, (b) the component and file plan, (c) the dependencies you want to add and why, (d) risks. Wait for my approval, then build in the stages in section 11.

## 1. The product and the job of this page

**Pickstall**: a no-code platform where course creators and digital-product sellers open a mobile-first store ("a stall"), host courses, sell downloads and take payments. **0% transaction fees**: we never take a cut of sales (customers pay the creator's own payment account; the payment provider's card processing fees still apply). We earn from a flat monthly plan. Audience: creators selling to customers in the US, UK and Canada, who arrive from Instagram and TikTok on a phone.

**Stage:** pre-launch. The page must (1) make a visitor understand the whole product in two minutes, (2) make them feel "I want my own stall today", and (3) collect waitlist signups for **10 founding creator spots** (free for 6 months, personal setup, direct line to the founder) with real email capture and a store-link reservation.

## 2. Creative concept: "Open your stall"

The brand name means the creator's own picks on their own stall. The page is a **scroll-told story of building and running a stall**, not a stack of generic sections.

- **Visual world:** a modern, flat-vector market stall: a scalloped awning, shelves, price tags, tear-off coupons, receipts. The scallop is the signature shape (awning edge = receipt edge = ticket edge). Warm, confident, playful, premium.
- **Signature moments (the page should be remembered for these):**
  1. **Hero "Build your stall" live demo** (section 5.2): the visitor types a store name, taps products onto a shelf, hits "Make a sale", and watches a receipt print with "Platform fee $0.00". It is the hero, not a screenshot of it.
  2. **Giant "0%"** as an oversized typographic object that physically interacts with the page (it is the awning's hanging sign; it swings slightly on load and reacts to pointer movement).
  3. **"From reel to receipt"** pinned scroll story (section 5.5): an animated path that draws itself from an Instagram reel to a tap to a checkout to a student library.
  4. **Tear-off coupon CTA** (section 5.10): the founding offer is a coupon the visitor tears along the dashed line to reveal the signup form.
  5. **Claim your stall link** (section 5.12): reserve `pickstall.com/yourname` in the final CTA with live availability feedback.
- **Tone:** confident, specific, a little playful. Short sentences. No hype, no exclamation spam.
- **Quality bar:** it should look like a studio-designed product site (think of the polish of the best SaaS and creator-tool sites), not a template. Intentional layout, strong hierarchy, asymmetric compositions, generous whitespace, big type, tactile details.

## 3. Rules and approved additions to DESIGN.md

Follow `DESIGN.md`. Approved additions for this page only:
- **Illustration:** flat vector SVG illustrations (stall, awning, shelf items, price tags, phone) using only palette tokens plus 2-3 tints of each. 2px ink outlines. No gradients, no 3D, no stock photos.
- **Hero typography** may exceed the scale up to `clamp(4rem, 14vw, 12rem)` for the "0%" only.
- **Scroll-driven and pointer-driven motion** beyond DESIGN.md section 12, within the motion rules in section 8 below.
- **Subtle paper texture** (static, under 4% opacity, optional) may be added to the background if it does not hurt performance or contrast.
- Still forbidden: gradients, glassmorphism, neon glow, emoji as icons, marquee/autoplaying looping motion, fake proof.

**Honesty rules (non-negotiable)**
- No fake testimonials, logos, user counts, revenue, press, or "as seen on". Demo content is labelled **"Demo"** or **"Example"** in the UI.
- Do not claim we handle taxes, VAT or chargebacks. Creators are the seller of record (FAQ says so).
- Every "0%" claim sits near: "Stripe's card processing fees still apply."
- Features not shipping at launch get a **"Coming soon"** tag. Launch (public beta): store, digital products, courses, pay-what-you-want, coupons, order bumps, purchase emails, dashboard. Coming soon: custom domain, email marketing, abandoned cart, upsells, funnels, memberships, bookings, affiliates, quizzes and certificates, import tools, AI helper, AutoDM, community.
- Scarcity is real: "10 founding spots". Show a live "spots left" or waitlist count only if it comes from real data (hide counts under 20; otherwise show "10 spots").
- Comparison content is generic ("platforms that take a cut of every sale"), never naming competitors. The calculator rate (10%) is labelled an assumed example.
- No claim of an exact setup time. Say "in minutes".

## 4. Tech and structure

- Next.js (App Router), TypeScript strict, Tailwind with DESIGN.md tokens, `next/font` for Bricolage Grotesque and Instrument Sans. Section components in `components/landing/` (one file per section) and primitives in `components/ui/`.
- Animation: CSS (including scroll-driven animations where supported, with a fallback) and the `motion` package for interactive sequences. Ask before adding anything else (for example a scroll library). Keep initial JS small; lazy-load below-the-fold interactive sections.
- All copy and constants in `content/landing.ts` and `lib/config.ts` (`BRAND`, `ROOT_DOMAIN`, `FOUNDING_SPOTS`, links). No hardcoded brand name.
- Illustrations as inline SVG React components with `aria-hidden` unless meaningful.
- Page must work with JavaScript animations disabled (content readable, form functional).

## 5. Page structure, copy and interactions

### 5.0 Announcement bar
"10 founding creator spots. Free for 6 months. 0% transaction fees." + link "Claim yours".

### 5.1 Nav
Sticky, shrinks on scroll, logo, links (Features, How it works, Compare, Pricing, FAQ), CTA "Claim your stall". Mobile: full-screen sheet, CTA always visible.

### 5.2 Hero: "Build your stall" (the star)
**Layout:** left column copy, right column the interactive stage. On mobile: copy first (compact), stage below, both within the first two screens, with the primary CTA visible without scrolling.

**Copy**
- H1: "Open your own stall. 0% transaction fees." (the "0%" is the giant hanging-sign object, see below)
- Sub: "Store, courses and downloads on one tap-to-buy page. No code. No cut of your sales."
- Primary CTA: "Claim your stall" (scrolls to the form or opens the inline form). Secondary: "Try the demo below" if needed on mobile.
- Microcopy: "Free to join. Founding creators get 6 months free. Stripe's card processing fees still apply."

**The hanging "0%"**: giant numeral on a sign that hangs from the awning by two cords. On load it swings once (damped); it tilts a few degrees following the pointer (disabled on touch and reduced motion). Words "transaction fees" sit on the sign beneath.

**The interactive demo (client-side only, no backend, label "Demo")**
1. **Name your stall:** an input "Your name or brand" (default "Maya's Money Studio"). The awning sign and the phone mockup header update live. Sanitize and cap at 30 characters.
2. **Stock your shelf:** four toggle chips: "Course $49", "PDF guide $19", "Template pack $29", "1:1 call $149". Each adds an item (with its price tag) to the shelf illustration and a product card to the live phone preview. Chips are real buttons with `aria-pressed`.
3. **Make a sale:** button "Make a sale". It animates a customer tap on the phone, prints a **receipt** (line items, "Platform fee $0.00", "Paid to your payment account"), shows a yellow toast "New sale: [item], $[price]", and increments a **running "You kept" total** (equal to the sale amount minus nothing, labelled "before card processing fees"). Repeating adds to the total. Keep the arithmetic honest and explained in small print.
4. After the first sale, a gentle prompt: "Like it? Claim your stall link" with a button that focuses the signup form.
- The demo must be keyboard-operable, announce changes via `aria-live`, and degrade to a static illustration under reduced motion (receipt appears instantly).
- Track `demo_name_changed`, `demo_item_added`, `demo_sale_made`.

### 5.3 Trust strip (honest)
One line: "Payments processed by Stripe. Apple Pay and Google Pay at checkout. Your money goes straight to your account." No logos unless brand guidelines are followed.

### 5.4 The 0% section: "We don't take a cut."
- H2: "We don't take a cut of your sales."
- Body: "Other platforms charge a percentage of every sale. We charge one flat monthly plan, so the more you sell, the more you keep."
- **Receipt reveal:** as the section enters the viewport, a long receipt prints line by line: Course sale $197.00, Platform fee $0.00, Card processing set by your payment provider, "Paid to your account".
- **Calculator (dark panel):** slider for monthly sales ($500 to $20,000, step $250, default $3,000), big amount readout, a bar comparing "per-sale fee at an assumed 10%" against "Pickstall platform fee: $0", live numbers with tabular figures. Footnote: "10% is an assumed example rate, not a quote for any platform. Card processing fees apply on top. Our flat monthly plan will be announced before launch."
- Track `calculator_used` once per session.

### 5.5 "From reel to receipt" (pinned scroll story)
- H2: "From reel to receipt, in one place."
- A pinned stage with five stops. An SVG path draws itself as the user scrolls; the active stop's panel changes:
  1. **Reel:** "Your audience finds you on Instagram or TikTok." (phone with a reel)
  2. **Tap:** "One link in your bio opens your stall." (stall page)
  3. **Pick:** "They pick your course, download or call." (product page, coupon applied)
  4. **Pay:** "Apple Pay or card. One screen. Order bump if you add one." (checkout)
  5. **Learn:** "They get instant access and your emails go out." (library and player)
- Each stop has a "Coming soon" tag where relevant. Mobile: a vertical stepper with the same panels (no pinning). Reduced motion: static list.

### 5.6 Everything on one shelf (feature bento with micro-interactions)
- H2: "Everything a course creator sells with, on one shelf."
- Asymmetric bento, each tile has a live mini UI that responds to hover/focus/tap:
  - **Storefront** (large): tappable store, theme switcher (Clean, Bold, Soft) that re-skins the tile.
  - **Course player:** progress bar fills as you click "Mark complete".
  - **Digital downloads + pay-what-you-want:** slider changes the price chip.
  - **Coupons:** ticket "SPRING20" you can click to apply to a mock cart and see the total change.
  - **Order bumps:** checkbox adds "+$9" to a mock total.
  - **Purchase emails:** receipt email mock.
  - **Dashboard:** mini revenue chart that animates on view (Example data).
  - Smaller "Coming soon" tiles: custom domain, email marketing, abandoned cart, funnels, memberships, bookings, affiliates, quizzes and certificates, import tools, AI helper.
- Each tile: one headline, one plain sentence of benefit.

### 5.7 See the product (device showcase)
- H2: "Built for your phone first. Powerful on your laptop."
- Tabs: **Your store**, **Your dashboard**, **Your student's view**. A laptop frame and a phone frame show designed mock screens (SVG/HTML, "Example data"). Tab change animates the screens. Include a short caption per tab.

### 5.8 Set up in three steps (no code)
- H2: "Live in minutes. No code."
- Three steps with a live preview that changes as each is selected (scroll-linked on desktop, tap on mobile): Pick a look > Add what you sell > Connect payments and publish. Closing line: "Most creators won't need a developer, a designer or a second tool."

### 5.9 Compare and benefits
- **Benefits (alternating rows with illustrations):** Keep more of what you earn. Replace three tools with one. Look premium on every phone. Own your customers. Sell more per order.
- **Compare table (generic):** columns Pickstall / Platforms that take a cut of every sale / Platforms that lock tools behind a top plan. Rows: fee on your sales, coupons and order bumps, courses and downloads, your own domain (Coming soon), switching from another platform (import tools: Coming soon). Footnote: "Based on typical market offerings. Check each platform's current pricing."

### 5.10 Founding offer: the tear-off coupon
- H2: "Founding creators: free for 6 months."
- A large coupon (dashed perforation line, scissors icon) reading "10 founding spots / 6 months free / Personal setup". The visitor drags (or taps "Tear here") along the dashed line; the coupon tears with a short animation and reveals the signup form beneath. Fallback: the form is simply visible when JS or motion is off, and the control is a button.
- Bullets: Free for the first 6 months. I set up your store with you. A direct line to the builder. Your feedback shapes what gets built next.
- Pricing note: "After the free period: one flat monthly plan, 0% transaction fees. You'll see the price before anyone is asked to pay." Do not invent prices.

### 5.11 Founder note, FAQ
- **Founder note:** photo slot `[FOUNDER PHOTO]`, short human note: "I'm [FOUNDER NAME], a designer and developer building Pickstall. I'm opening 10 spots to creators who want a simpler, cheaper store. I'll set it up with you and read every message." Placeholders only; no invented bio.
- **FAQ (accessible accordion):** Is it live yet? What do you mean by 0% transaction fees? What does it cost after the free period? Do I need to code? How do I get paid? Who handles taxes? Which countries? Can I sell downloads as well as courses? Can I use my own domain? Can I bring my customers and products from another platform? (Answers: not live yet; no percentage of sales, card processing fees still apply; flat plan announced before launch; no code; payments go to your own payment account; you handle taxes as the seller, we do not; US, UK, Canada first; yes; planned, not in first release; import tools are planned.)

### 5.12 Final CTA: "Claim your stall"
- Giant H2: "Your stall is waiting." with the form: email (required), **desired store link** with prefix `pickstall.com/` and live availability feedback (debounced check against reserved and taken slugs), optional "What do you sell?", consent line. Button "Claim my stall".
- On success: a printed-ticket confirmation "Stall reserved: pickstall.com/yourname" with "Check your email to confirm" and a share button. If the slug was taken, suggest 3 alternatives.
- Make clear: "Your link is reserved for the waitlist and confirmed at launch, subject to availability and our naming rules."

### 5.13 Footer
Logo, one-line description, links (Features, Pricing, FAQ), `hello@[DOMAIN]`, Privacy and Terms (`/privacy`, `/terms`), social placeholders, copyright, and "Stripe's card processing fees apply to creator sales."

## 6. Email collection (real, compliant, owned by us)

**Where emails are stored:** our own database (Supabase) via a server route, not a third-party form tool. We own the list and later import it into our own email system.

**Fields captured**
- `email` (required, unique, lowercased), `desired_slug` (optional), `sells` (optional enum), `source` (page path), `utm` (jsonb), `consent_text_version`, `consent_at`, `status` (`pending` | `confirmed` | `unsubscribed`), `confirm_token_hash`, `confirmed_at`, `created_at`.

**Flow (double opt-in)**
1. `POST /api/waitlist`: validate with Zod, honeypot field, per-IP rate limit, normalize and validate the slug (`^[a-z0-9-]{3,30}$`, reject `RESERVED_SLUGS` and profanity), store `pending`, create a random token (store only its hash).
2. Send a confirmation email (Resend, queued) from a verified domain: sender identity, why they got it, one-click "Confirm my spot" link, unsubscribe line and physical address placeholder (CAN-SPAM / CASL).
3. `GET /api/waitlist/confirm?token=...` sets `confirmed`, shows a success page, and sends a short welcome email.
4. Only `confirmed` emails count as signups and keep a reserved slug. Pending slugs expire after 7 days.
5. Duplicate emails return the same friendly success message (do not reveal whether the email exists).
6. Every email has an unsubscribe link that sets `unsubscribed`.

**Consent copy (not pre-ticked):** "I agree to receive emails about Pickstall's launch and my founding creator spot. I can unsubscribe anytime." with a link to the Privacy page. Store the exact text version.

**Security:** RLS enabled on `waitlist` with no public policies; all writes through the server with the service role key (never in client code); hash tokens; rate limit confirm and slug-check endpoints; do not log full emails in analytics.

**Admin:** a protected `/admin/waitlist` page (or a documented SQL view and CSV export) so the founder can see confirmed signups, reserved slugs and sources.

**Slug check endpoint:** `GET /api/waitlist/slug?slug=...` returns `available` / `taken` / `invalid` without revealing other users' emails, with rate limiting.

## 7. Analytics (privacy-aware)

PostHog events: `page_view`, `cta_click` (section id), `demo_name_changed`, `demo_item_added`, `demo_sale_made`, `calculator_used`, `story_stop_viewed`, `coupon_torn`, `slug_checked`, `waitlist_submitted`, `waitlist_confirmed`, `faq_opened`, `scroll_depth`. Analytics stay off for EU/UK visitors until consent via a minimal banner.

## 8. Motion rules (make it feel alive without being noisy)

- Orchestrate: the hero sequence is staged (awning scallops draw in, sign swings, shelf and phone settle, copy lines rise). After that, motion responds to the user.
- Scroll motion only for: the receipt reveal, the pinned "reel to receipt" story, the device showcase tab change, and chart/bar fills on view. No fade-up on every section.
- Pointer motion: gentle tilt on the hanging sign and phone mockup, magnetic hover on primary buttons (small), disabled on touch.
- Durations from DESIGN.md tokens. Animate only `transform` and `opacity`. Springs for the sign swing and coupon tear.
- `prefers-reduced-motion`: all choreography replaced by instant final states; the demo still works; no pinned scroll sections.
- Pause or skip any looping animation when the tab is hidden. No autoplaying sound or video.

## 9. Responsive, accessibility, performance

- Design at 390px first, then 768, 1024, 1440. No horizontal page scroll. Safe-area insets respected. Touch targets 44px. Sticky mobile CTA bar appears after the hero.
- WCAG 2.1 AA, both light and dark mode, visible focus, semantic landmarks, keyboard-operable demo, calculator, tabs, accordion and coupon tear (button alternative). `aria-live` for demo results and form status. Illustrations `aria-hidden` unless informative.
- Lighthouse mobile: Performance >= 90, Accessibility >= 95, SEO >= 95. LCP < 2.5s, CLS < 0.1, INP < 200ms. Initial JS budget about 150 KB gzipped; lazy-load heavy sections; fonts via `next/font`; no layout shift from illustrations (reserve space).
- SEO: metadata, canonical, Open Graph and Twitter image generated with `next/og` (flat ink background, yellow and blue shapes, wordmark, one headline), JSON-LD `Organization` with true facts only, `sitemap.ts`, `robots.ts`.

## 10. Placeholders to leave clearly marked

`[FOUNDER NAME]`, `[FOUNDER PHOTO]`, `[DOMAIN]`, support email, Privacy and Terms pages, social links, physical address for emails, Supabase/Resend/PostHog keys (names only in `.env.example`).

## 11. Stages (commit after each, report what is done and what is left)

1. **Plan** (section 0 above). Wait for approval.
2. **Foundation:** config and content files, tokens, fonts, layout, nav, announcement bar, footer, illustration primitives (awning, shelf, tag, receipt, coupon, phone).
3. **Hero demo:** hanging sign, stall illustration, interactive "Build your stall" with receipts and toasts, responsive and reduced-motion versions.
4. **Sections:** 0% receipt + calculator, reel-to-receipt story, bento, device showcase, steps, benefits and compare, founding coupon, founder, FAQ, final CTA.
5. **Waitlist backend:** migration SQL, API routes (submit, confirm, slug check), Zod, honeypot, rate limit, Resend emails, unsubscribe, admin view.
6. **Polish:** motion pass, analytics and consent banner, SEO and OG image, accessibility audit, Lighthouse, tests (calculator math, slug rules, waitlist validation and double-opt-in flow, one Playwright run of the hero demo and form).

## 12. Definition of done

- [ ] Builds with `pnpm build`; lint, typecheck and tests pass
- [ ] The hero demo works end to end by mouse, touch and keyboard
- [ ] All sections in section 5 exist with the specified copy; "Coming soon" on unshipped features; "Demo/Example" labels on mock data
- [ ] Waitlist: double opt-in works, duplicates handled, slug reservation works, RLS on, no secrets client-side, unsubscribe works
- [ ] Brand name comes from `BRAND` only
- [ ] No fake proof, no tax claims, every 0% claim has the card-processing note
- [ ] Lighthouse mobile >= 90 (Performance), >= 95 (Accessibility, SEO); no horizontal scroll at 390px
- [ ] Light and dark modes both polished; reduced motion respected
- [ ] Final report lists every placeholder I must fill

Start with the plan now.
