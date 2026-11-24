# Pickstall Growth Portal and AI marketing agents (plan v1, 2026-11-23)

Goal: AI agents run Pickstall's marketing from start to finish (research, outreach drafts, conversations, content, SEO, onboarding nudges and tracking) and send the founder a **daily report every evening**. The founder only approves and clicks "send" where a platform requires a human, and takes setup calls.

Strategy, positioning, audience and DM tone come from `docs/MARKETING_PLAN.md`. This file is the **system** that carries that plan out.

---

## 0. Hard limits (the honest part)

These decide the design. Ignoring them gets the founder's accounts banned or breaks the law.

| Limit | Why | How the system handles it |
|---|---|---|
| **Instagram, TikTok and LinkedIn do not allow automated cold DMs.** Instagram's official Messaging API only lets a business account answer people who messaged it first (inside a 24-hour window). LinkedIn bans automation tools. Bots that log in as you get the account blocked. | Platform terms; account bans | Agents **research and write** every first DM. The portal opens the creator's profile and copies the message; the founder pastes and sends (about 20 seconds per DM, 10-15 minutes a day). |
| **X allows DMs through its API, but its automation rules forbid unsolicited bulk DMs.** | Platform terms | Same as above: human sends first DMs. |
| **Replies on Instagram can be automated** through the official Messaging API once the creator writes back, if the founder connects an Instagram professional account and a Meta app (needs Meta app review). | Official, allowed | Phase 2: inbound Instagram replies arrive in the portal; the agent drafts an answer. Founder approves with one click (or turns on auto-send for simple FAQ answers later). |
| **Cold email:** allowed to US business contacts under CAN-SPAM (real sender, physical address, working unsubscribe). Canada (CASL) and the UK (PECR, for sole traders) need prior consent. Resend's terms do not allow cold or unsolicited email, and cold mail would hurt the domain that sends buyers their receipts. | Law and Resend terms | Email outreach only to US contacts with a public business email, from a **separate domain and mailbox** (for example `hello@getpickstall.com` on Google Workspace), max 20-30 a day, never through Resend or the main domain. Canada/UK contacts get DMs only. |
| **The AI speaks as the founder.** | Trust and honesty | Every message goes out under the founder's name, written in the founder's voice, and nothing is sent that the founder has not approved (until a message type is explicitly switched to auto-send). Agents never invent facts, numbers, testimonials or features (PRD 2.6). |
| **The creator list is other people's personal data.** | Privacy (GDPR/UK GDPR for UK creators) | Stored only in our MongoDB, admin-only. Every lead has an opt-out; "stop", "not interested" or no answer after 1 follow-up puts them on a permanent do-not-contact list. Delete-on-request button. |
| **Claude Code (me) is not running all day.** | How this tool works | The agents run **inside the Pickstall app** as Inngest jobs calling the Claude API, every day, on their own. Claude Code builds and improves them; a weekly scheduled Claude review is optional. |
| **Setup calls need a person.** | Trust | The agent books the call (Cal.com link) and prepares a brief on the creator; the founder joins. |

**What the founder does each day (about 30-45 minutes):** approve the agent's drafts, send the day's DMs from their own phone or browser, reply-approve conversations, read the evening report, take booked calls.

---

## 1. Where it lives: the Growth Portal

**Recommendation: build it inside the existing admin (`/admin/growth`), not as a separate app.**

- Admin sign-in, sessions, rate limits and the audit log already exist (D-107..D-109, D-116).
- MongoDB, Inngest, PostHog and Sentry are already set up; the daily report can use the real creator and order data directly.
- A separate app would need its own sign-in, deploy and copy of the data, for no gain at this stage.
- Code stays separate: `lib/marketing/*` for logic, `app/admin/(panel)/growth/*` for screens, collections prefixed `mkt`.

### Portal screens
1. **Today**: the daily to-do: DMs to send (with "Open profile" + "Copy message" + "Mark sent"), replies waiting for approval, calls today, content to approve.
2. **Leads**: imported creator list, fit score, stage (new, researched, drafted, sent, replied, call booked, signed up, store live, first sale, paid, lost, do-not-contact), each with a personal tracking link.
3. **Conversations**: thread per lead; paste a reply (or it arrives from Instagram/email automatically); the agent's suggested answer with intent label; approve, edit or reject.
4. **Content**: daily post drafts (X, LinkedIn), video scripts, weekly SEO page drafts; approve, edit, schedule.
5. **Funnel and reports**: live funnel, per-channel numbers, every past daily report.
6. **Settings**: daily DM limit, which message types may auto-send, do-not-contact list, agent on/off switches.

---

## 2. The agents

Each agent is an Inngest function in `lib/marketing/agents/`, calls the Claude API with a fixed system prompt (positioning and honesty rules from `MARKETING_PLAN.md`), validates its output with Zod, and writes to MongoDB. Model choice per agent is decided in the build block after checking current Claude models and prices (larger model for writing, a small fast model for labelling).

| # | Agent | Trigger | Does | Output |
|---|---|---|---|---|
| A1 | **Lead Importer** | Founder uploads CSV | Cleans the list, removes duplicates and do-not-contact entries, detects platform (Gumroad, Stan, Etsy, other) from the link | Leads at stage "new" |
| A2 | **Lead Researcher** | New lead | Reads the creator's **public store or website page only** (no logged-in scraping of Instagram/TikTok), notes what they sell, price range, niche, audience country hints; scores fit against Beachhead A/B | Fit score 0-100, 3-line brief, "skip" reason if poor fit |
| A3 | **Outreach Writer** | Researched lead with fit ≥ 60 | Writes a personal first DM and one follow-up in the founder's voice, mentioning one real detail; picks channel (DM vs US email); adds the lead's tracking link | Draft in "Today" queue |
| A4 | **Follow-up Scheduler** | Daily | Lines up the single follow-up after 4 days of silence; marks no-reply-after-follow-up leads as lost; never contacts a lead a third time | Follow-up drafts, stage updates |
| A5 | **Conversation Agent** | Reply pasted or received | Labels intent (interested, question, objection, not now, stop), drafts an answer from the objection bank, offers the call link when interested, adds "stop" to do-not-contact instantly | Suggested reply, stage update |
| A6 | **Call Prep** | Call booked (Cal.com webhook) | One-page brief: what they sell, where, current platform and fees, what to migrate, likely objections | Brief in portal and in the morning email |
| A7 | **Activation Coach** | Signed-up creator stuck (no store after 1 day, no PayPal after 3 days, no sale after 14 days) | Drafts a short, helpful lifecycle email (with the PayPal video link); these are our own users, sent through the normal email system with unsubscribe | Nudge emails (approve first, auto-send later) |
| A8 | **Content Agent** | Daily | One build-in-public post for X and LinkedIn from real data (what shipped from git log, real numbers from the report), 3 short-video scripts a week | Drafts in "Content" |
| A9 | **SEO Agent** | Weekly | Drafts one comparison, alternative or how-to page (`/compare/stan-store`, `/compare/gumroad`, guides), with competitor numbers marked "verify before publishing" | Page draft; publishing is a normal code change |
| A10 | **Reporter** | Every day 21:00 IST | Collects all numbers (section 3), writes a plain-language summary, the best and worst thing of the day, and tomorrow's 3 priorities | Email to founder + saved report in portal |

**Posting content automatically** (X API, LinkedIn API) is a later option: X's API write access is a paid tier and LinkedIn needs app approval. Until then the founder copies the approved post (1 minute a day).

---

## 3. Tracking: what the evening report shows

Every lead gets a personal link: `pickstall.store/?ref=<leadCode>`. The code is saved at signup, so one DM can be followed all the way to a paid plan.

**Daily report contents:**
1. **Outreach:** DMs and emails sent today, replies, reply rate, calls booked, do-not-contact added.
2. **Funnel (from our database):** new signups (from outreach vs badge vs organic), stores published, PayPal connected, first sales, plans started; and the 7-day trend.
3. **Per-lead movement:** who moved a stage today (for example "Priya: replied, call booked Thursday").
4. **Website (PostHog):** landing visits, signup rate, top sources, "Powered by Pickstall" badge clicks.
5. **Content:** posts approved and published, best post by clicks on its tracking link.
6. **Problems:** where people are dropping off, creators stuck, agent errors.
7. **Tomorrow:** the 3 things the founder should do.

Numbers come straight from MongoDB and PostHog; the AI only writes the summary and suggestions, so the numbers stay correct.

---

## 4. Build blocks (one session each, plan and approval before each, per CLAUDE.md)

| Block | What | Needs from founder |
|---|---|---|
| **M1. Tracking base** | PostHog events for the funnel, `?ref=` codes stored at signup, "Powered by" badge link with a source | PostHog project key (exists in env list) |
| **M2. Growth portal + leads** | `/admin/growth` screens, `mktLeads` + `mktEvents` collections, CSV import with column mapping, stages, do-not-contact, delete lead | Approval of new collections; the creator list |
| **M3. Research + Outreach agents** (A1-A4) | Claude API connection, research of public pages, DM drafts, "Today" queue with Open/Copy/Mark sent, follow-ups | Approval to add `@anthropic-ai/sdk`; `ANTHROPIC_API_KEY`; a few real DMs you liked, to learn your voice |
| **M4. Conversations + calls** (A5, A6) | Conversation threads, intent labels, reply drafts, Cal.com link and webhook, call briefs | Cal.com account and link |
| **M5. Daily report** (A10) | 21:00 IST Inngest job, report email and report page | Which email gets the report |
| **M6. Activation coach** (A7) | Stuck-creator detection, nudge emails, approve-then-auto-send switch | Approval of email copy |
| **M7. Content + SEO agents** (A8, A9) | Post and script drafts, weekly page drafts | Social handles; tone examples |
| **M8. Inbound channels (optional)** | Instagram Messaging API inbound replies; separate outreach mailbox (send via its own SMTP/API, with inbound replies) | Meta app + review; second domain + mailbox |

Order matters: M1 → M2 → M3 → M5 gives the founder working outreach and a daily report fastest. M4, M6, M7, M8 after.

---

## 5. Safety and quality rules for every agent

- Agent output is **data**, validated with Zod; nothing an agent writes is executed or rendered as HTML.
- Text read from a creator's page or a reply is untrusted: agents treat it as information only, never as instructions (prompt-injection guard), and never paste it raw into emails.
- Agents may only use facts from: `MARKETING_PLAN.md`, the lead's own public page, and our database. No invented numbers, quotes, testimonials or features.
- Every "0%" mention carries the PayPal fee note. No tax claims. No card-checkout promise.
- Daily caps (DMs, emails, Claude API spend) set in Settings; jobs stop when a cap is reached and the report says so.
- API keys server-only; leads collections admin-only; every admin action on leads goes to the audit log.
- Tests: CSV import validation, stage rules (no third contact, do-not-contact always wins), report numbers match the database, agents' output schema.

---

## 6. What this does NOT do

- Log into the founder's Instagram, TikTok, LinkedIn or X and send messages as a bot.
- Send cold email through Resend or the main domain, or to Canada/UK contacts without consent.
- Join calls or talk on the phone.
- Spend ad money (paid ads stay off until the rule in `MARKETING_PLAN.md` section 0 is met).
- Publish anything the founder has not approved, until a message type is explicitly switched to auto-send.
