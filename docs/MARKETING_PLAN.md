# Pickstall go-to-market plan (v1, 2026-11-23)

Owner: founder (solo). Budget assumed: close to zero cash, about 3-4 hours a day of founder time.
Goal for the first 90 days: **10 founding creators live, 5 with a real sale, 2 honest case studies, then a public launch.**

---

## 0. The honest starting point (read this first)

A marketing plan only works if it matches where the product really is. Today:

| Fact | What it means for marketing |
|---|---|
| PayPal **live approval is still pending** (LAUNCH_CHECKLIST D) | No paid ads and no public launch yet. Until live, we recruit founding creators and build the audience. Do not send traffic to a store that cannot take real money. |
| Creators must **create a PayPal REST app and paste keys** | This is the biggest drop-off point in the funnel. Every marketing promise must be backed by "we set it up with you". Apply to the PayPal partner program as soon as possible. |
| Checkout is **PayPal only** (Stan uses Stripe cards) | Some buyers trust card checkout more. Target creators whose buyers already pay with PayPal (US/UK/Canada template, preset and course buyers do). Never claim card checkout. |
| India PayPal business accounts **cannot receive from Indian buyers** | Indian creators are a fit only if they sell to US/UK/Canada buyers. Do not market to Indian creators selling to Indians. |
| No product analytics is wired yet (PostHog key exists, no events) | We cannot improve what we cannot see. Week 1 task: track the activation funnel (section 7). |
| A lot is already built (courses, emails, funnels, upsells, affiliates, reviews, certificates, license keys) | Strong feature story. The problem is not features; it is **trust and distribution**. |

**Rule:** no ad money is spent until at least 5 creators have gone from signup to first sale without the founder doing it for them.

---

## 1. Positioning

### 1.1 One sentence
**Pickstall is the link-in-bio store for course creators and digital sellers: Stan Store's pro tools at $39 instead of $99, and 0% transaction fees, unlike Gumroad's 10%.**

### 1.2 Why a creator switches (the three wedges)

1. **Price vs Stan Store.** Stan: $29/mo Creator, $99/mo Creator Pro (about $79/mo yearly); email broadcasts, upsells and discount codes sit on Creator Pro. Pickstall: Starter $19 (coupons, order bumps, lead magnets, pixels), Pro $39 (upsells, funnels, automations, coaching calls). A Stan Pro user saves about **$60 a month, $720 a year** (monthly billing).
2. **Fees vs Gumroad.** Gumroad: 10% + $0.50 per direct sale (30% on Discover). A creator doing $2,000 a month in 50 sales pays Gumroad about **$225 a month**; on Pickstall Starter they pay **$19**. PayPal's processing fees apply on both.
3. **Customization.** Button text, checkout questions, thank-you message, purchase email in your own words, 9 store themes. Stan stores all look the same; this is a visible difference in screenshots.

> Competitor prices were checked on 2026-11-23 from third-party 2026 reviews (sources at the end). **Re-check stan.store and gumroad.com/pricing on the day you publish any comparison.** Never publish a number you have not seen on their own page.

### 1.3 Who we are NOT for (say it openly, it builds trust)
- Creators who need card checkout with Apple Pay today.
- Creators selling mainly to buyers in India.
- People who want a marketplace that brings buyers (we bring tools, they bring the audience).

### 1.4 Honesty rules for every piece of marketing (PRD section 2.6)
- Every "0% fees" sits next to "PayPal's processing fees still apply."
- No fake testimonials, user counts, logos or "trusted by" lines. Demo stores are labelled "Example".
- Never say we handle tax or VAT. Creators are the seller of record.
- Features not live are tagged "Coming soon" (TikTok pixel, custom domain).

---

## 2. Ideal customer (start narrow, widen later)

Marketing to "all creators" means reaching nobody. Start with **one beachhead**, win it, then widen.

### Beachhead A (main): template and digital-download sellers already paying Gumroad's 10%
- Sell Notion templates, Canva templates, Lightroom presets, budget spreadsheets, planners, ebooks, study notes.
- 1k-50k followers on Instagram, TikTok, X or Pinterest. Earn $300-$5,000 a month.
- Buyers in US/UK/Canada, used to paying with PayPal.
- Pain: "Gumroad takes too much", "my Stan store looks like everyone's".
- Why they fit now: digital downloads are our most tested flow; they do not need video yet.

### Beachhead B (founder's unfair advantage): Indian creators selling to global buyers
- Indian designers, Notion builders, editors and coaches who already sell on Gumroad, Etsy or Payhip to US/UK buyers.
- The founder speaks their language (Gujarati, Hindi), shares the timezone, and understands the "PayPal India only receives international payments" rule.
- Personal onboarding on a WhatsApp or Google Meet call is easy here and builds loyalty fast.

### Later (after courses are proven with 3+ creators): course creators leaving Stan Pro, Kajabi or Teachable for price.

---

## 3. Channels, ranked for a solo founder with no ad budget

| # | Channel | Cost | Speed | Why |
|---|---|---|---|---|
| 1 | **Founder-led personal outreach (DMs)** | Time only | Fast | The only reliable way to get the first 10. |
| 2 | **Done-for-you migration** ("we move your store for free") | Time | Fast | Removes the switching pain, which is the real objection. |
| 3 | **"Powered by Pickstall" badge on every store** | Free, already built | Slow, compounds | Every creator's followers see it. Make sure it links to the landing page with `?ref=store`. |
| 4 | **Comparison + calculator SEO pages** | Time | 2-4 months | "Stan Store alternative", "Gumroad alternative", "Gumroad fee calculator" are searched by people ready to switch. |
| 5 | **Build in public** on X and LinkedIn | Time | Medium | Indie creators love following a founder; builds trust for a new brand. |
| 6 | **Short video** (Reels, Shorts, TikTok) | Time | Medium | Show a store being built in 60 seconds, the fee math, before/after migrations. |
| 7 | **Creator referral program** (1 free month per paying referral) | Revenue we skip | Compounds | Creators know other creators. This is about Pickstall plans only, never about creators' sales money. |
| 8 | **Communities** (Reddit, Facebook groups, Indie Hackers, Discord) | Time | Medium | Only by giving real help; promote only where the rules allow. |
| 9 | **Product Hunt + launch week** | Free | One spike | Only after PayPal live and 2 case studies. |
| 10 | **Small paid test** (Google search on competitor-alternative keywords) | $200-300 test | Fast | Only after the "no ads" rule in section 0 is met. |

**Skip for now:** AppSumo or lifetime deals (video and email costs make lifetime plans dangerous), big influencer sponsorships, cold email to Canada and the UK (CASL and PECR need prior consent; use DMs instead), any bought email list.

---

## 4. The 90-day plan

### Phase 1: Foundations (days 1-14)

Product and tracking (small dev tasks, one session each):
- [ ] Track the activation funnel in PostHog: `signup`, `store_published`, `product_published`, `payment_connected`, `first_sale`, `plan_started`. Without this we fly blind.
- [ ] Add `?ref=` source to the "Powered by" badge link and to signups, so we know which store brought which creator.
- [ ] A "Founding creator" application form on the landing page (name, store link, what they sell, current platform, monthly sales range). Replaces open signup for now and makes the 10 spots feel real.
- [ ] Record a **3-minute screen video**: "Connect PayPal to Pickstall". Put it on the Payments page and send it to every creator. This is the biggest friction fix possible without code.

Founder tasks:
- [ ] Build **2 example stores** yourself (one template seller, one course creator), labelled "Example". They are the demo in every DM and video.
- [ ] Set up a support email and a WhatsApp Business number; answer within a few hours. Speed of reply is the trust signal of a tiny startup.
- [ ] Profiles: X, LinkedIn, Instagram, YouTube under `pickstall` (same handle everywhere; check availability).
- [ ] Write the founder story once (why you built it, why 0% fees) and pin it on X and LinkedIn.
- [ ] Make a list of **150 target creators** in a sheet (section 5.1 shows where to find them).

### Phase 2: Founding 10 (days 10-45)

- Send **10-15 personal DMs a day** (section 5.2 scripts). Expect about 1 reply in 10, and 1 setup call in 3 replies.
- Offer: free for 6 months, **we migrate your products and set up your store with you on a 30-minute call**, direct line to the founder.
- On every call: set up their store, connect PayPal together, publish one product, make a test purchase in sandbox until live mode, then a real one.
- After 2 weeks, ask: "How would you feel if Pickstall disappeared?" (very / somewhat / not disappointed). Aim for 40%+ "very".
- Write down every objection word for word. They become landing page FAQ and ad copy later.
- Weekly target: 2-3 new founding creators live.

### Phase 3: Proof and content engine (days 30-75)

- **Case studies** (with written permission): "How [creator] moved from Gumroad and kept $X more in October." Real numbers only, screenshot from their own dashboard.
- Publish SEO pages (one a week):
  1. `/compare/stan-store` - Pickstall vs Stan Store (honest table, including where Stan is better).
  2. `/compare/gumroad` - Pickstall vs Gumroad.
  3. `/tools/gumroad-fee-calculator` - the landing fee calculator as its own page.
  4. `/alternatives/stan-store` and `/alternatives/gumroad` ("best alternatives", Pickstall listed honestly among others).
  5. Guides: "How to sell Notion templates", "How to sell Lightroom presets", "How to sell a digital product on Instagram".
  (These need a small dev block each: page, metadata, sitemap entry.)
- Content rhythm (about 5 hours a week):
  - X / LinkedIn: 1 build-in-public post a day (what shipped, a number, a lesson).
  - Short video: 3 a week (store build speed-run, fee math, a founding creator's store tour).
  - 1 long post or guide a week, reused into a thread, a carousel and a short.
- Start the **referral program**: every founding creator gets a link; 1 free month per creator who becomes paid.

### Phase 4: Public launch (days 60-90, only after PayPal live)

- Launch checklist: PayPal live, 5+ creators with real sales, 2 case studies, comparison pages live, funnel tracking live.
- **Launch week:** Product Hunt (Tuesday-Thursday, prepare a hunter, gallery images, a 60-second video), Indie Hackers post, X thread with the build story, email everyone on the waitlist, ask founding creators to share their store with "built on Pickstall".
- Launch offer for the first 100 after the founding 10: for example 3 months of Starter at 50%. Decide the exact offer in Phase 3 based on what founding creators say about price.
- Paid test: $200-300 on Google search for "stan store alternative", "gumroad alternative", "cheaper than stan store". Stop any keyword with no signup after $50.

---

## 5. Outreach playbook

### 5.1 Where to find creators (search, then personalize; never mass message)
- Google: `site:gumroad.com "notion template"`, `site:stan.store`, `"stan.store/" instagram`, then open their Instagram or X profile.
- Instagram and TikTok bios with `stan.store/` or `gumroad.com/` links (search hashtags like #notiontemplate, #lightroompresets, #digitalproducts, #canvatemplates).
- Etsy digital download shops with an Instagram link.
- X: people posting "just made my first sale on Gumroad", "Gumroad fees".
- Beachhead B: Indian designer and freelancer communities on LinkedIn, X and Instagram; your own network first.

Pick creators with 1k-50k followers who posted in the last 2 weeks. Big creators will not answer a new tool.

### 5.2 DM scripts (edit for each person; mention one real thing from their profile)

**First message (Gumroad seller):**
> Hey [name], loved your [specific template]. Quick question: are you still selling on Gumroad? I'm building Pickstall, a link-in-bio store with 0% transaction fees (you'd pay PayPal's processing fee only, no 10% cut). I'm taking 10 founding creators: free for 6 months and I'll move your products over myself. Want me to send a 1-minute look?

**First message (Stan seller):**
> Hey [name], your Stan store is really clean. I'm building Pickstall: same idea (link-in-bio store), but email broadcasts, upsells and funnels are in a $39 plan instead of $99, and you can change your button text, checkout questions and theme. Looking for 10 founding creators, free for 6 months, and I'll set it up with you. Curious?

**Follow-up (after 4 days, once only):**
> No worries if now's not the time. Here's an example store so you can see it: [example link]. If you ever want it, the founding spot is yours.

**Rules:** one follow-up only. No message to anyone who did not reply twice. Never send the same text to many people. Respect each platform's rules on messaging.

### 5.3 Setup call (30 minutes)
1. 5 min: what they sell, where the followers are, what annoys them today.
2. 15 min: create store, theme, move 1-3 products, connect PayPal together.
3. 5 min: publish, put the link in their bio together.
4. 5 min: agree on a check-in in 7 days; ask for feedback anytime on WhatsApp.

---

## 6. Messaging bank

**Headline options for landing tests:**
- "Sell your digital products from one link. Keep 100% of your sales." (+ fee note)
- "Stan Store's pro tools, for $39 instead of $99."
- "Stop giving Gumroad 10%."
- "Your store, your words: change everything, even the buy button."

**Objections and answers:**
| Objection | Answer |
|---|---|
| "I've never heard of you." | Founding program: you talk to the founder directly, free 6 months, we move you back out with a full CSV export if you leave. |
| "Switching is a pain." | We do the migration for you on a 30-minute call. |
| "Why PayPal and not cards?" | Money goes straight into your own PayPal; Pickstall never holds it. (Do not promise card checkout.) |
| "Is 0% real?" | Yes. We earn from the monthly plan only. PayPal's processing fees still apply, like any store. |
| "What if you shut down?" | Your buyers and orders export to CSV any time; your money is already in your PayPal. |

---

## 7. Metrics and weekly rhythm

**North star:** number of creators who made at least one real sale in the last 30 days.

**Funnel (track weekly in PostHog once wired):**
| Step | Target for founding cohort |
|---|---|
| Signup to store published | 70% |
| Published to PayPal connected | 60% |
| Connected to first sale (30 days) | 40% |
| Free period to paid | 5+ of 10 |

**Outreach numbers (weekly sheet):** DMs sent, replies, calls booked, stores live, first sales.

**Every Monday (30 minutes):** look at last week's numbers, pick the single biggest drop-off, fix one thing (product, copy or onboarding). Every Friday: one build-in-public post with the week's real numbers.

---

## 8. Budget

| Phase | Spend | On what |
|---|---|---|
| Days 1-60 | $0 - $30 / month | Domain email, maybe a scheduling tool (Cal.com free tier), Canva free |
| Product Hunt launch | $0 | Time and preparation |
| Paid test (after section 0 rule) | $200 - $300 once | Google search, competitor-alternative keywords |

---

## 9. Product changes that would help marketing most (for future dev blocks)

In order of impact; each needs its own plan and approval (CLAUDE.md section 1):
1. PostHog funnel events and `?ref=` source tracking. (Small)
2. Founding creator application form on the landing page. (Small)
3. PayPal setup video and a clearer step-by-step on the Payments page. (Small)
4. Comparison and calculator pages under `/compare` and `/tools`, added to the sitemap. (Medium)
5. Pickstall referral program for plans (needs billing changes, so it touches payment logic: plan first). (Medium)
6. Import from Gumroad / Stan (already on the Phase 3 roadmap). Removes the biggest switching pain. (Large)
7. PayPal partner program approval for one-click connect. (Founder application, no code until approved)

---

## 10. First 7 days, day by day

| Day | Do |
|---|---|
| 1 | Claim social handles. Write and pin the founder story. Start the 150-creator sheet (30 names). |
| 2 | Build Example store #1 (template seller). Add 30 more names. |
| 3 | Record the "Connect PayPal" video. Send first 10 DMs. |
| 4 | Build Example store #2 (course creator). 10 DMs. First build-in-public post. |
| 5 | Dev session: PostHog funnel events + `?ref=` tracking. 10 DMs. |
| 6 | Dev session: founding creator application form. 10 DMs. First short video (store speed-run). |
| 7 | Review: replies, calls booked, objections heard. Adjust the DM script. |

---

## Sources (checked 2026-11-23, re-check before publishing comparisons)
- Stan Store pricing: [checkoutpage.com](https://checkoutpage.com/blog/stan-store-pricing), [cartmango.com](https://cartmango.com/stan-store-pricing/), [schoolmaker.com](https://schoolmaker.com/blog/stan-store-pricing.md)
- Gumroad fees: [checkoutpage.com](https://checkoutpage.com/blog/gumroad-fees), [sellfy.com](https://sellfy.com/blog/gumroad-pricing/), [dodopayments.com](https://dodopayments.com/blogs/gumroad-fees-explained)
