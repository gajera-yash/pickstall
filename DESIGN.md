# DESIGN.md: Design system v2.0 (white, professional)

> Source of truth for all UI. Read the sections you need (see the read map in `CLAUDE.md`). If something is missing, propose an addition here first, then build.
> Product: Pickstall (read the name from `lib/config.ts`, never hardcode). The app UI is **white, calm and professional with Stan-like centered layouts**. The marketing landing page may use the playful stall/receipt motifs from `LANDING_PAGE_PROMPT_V2.md` (section 7); the app does not.

---

## 0. Rules for Claude Code

1. **Never hardcode** a color, font, radius, shadow or spacing value. Use the tokens in section 16.
2. Light (white) theme only in Phase 1. Keep tokens structured so a dark theme can be added later; do not build dark mode now.
3. Every screen works at **360 px**, with keyboard only, and with `prefers-reduced-motion`.
4. Reuse components from `components/ui/` (shadcn base, restyled per section 9). No one-off buttons, inputs or cards.
5. Every data view has **loading, empty, error and populated** states.
6. Demo data in the UI is labelled **"Example"**.
7. Icons from `lucide-react` only (2px stroke). No emoji as icons.
8. After building a screen, run the checklist in section 19.

---

## 1. Brand and personality
Confident, clear, trustworthy with money, quietly premium. A creator should feel "this is a serious tool" within seconds. White space, crisp type, soft borders, one blue action.

## 2. Principles
1. **Money is the hero:** amounts are large, tabular and honest; fees are always visible.
2. **Mobile-first** (creators and buyers come from Instagram and TikTok).
3. **One primary action per screen.**
4. **Quiet UI:** content first; borders are soft; color is for meaning.
5. **Honest UI:** no fake proof or dark patterns.
6. **Accessible by default:** WCAG 2.1 AA.

---

## 3. Color (light theme)

Contrast is measured (WCAG). Text needs 4.5:1 (3:1 for large text), UI component boundaries 3:1.

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#FFFFFF` | Page background (auth, storefront, cards) |
| `--bg-subtle` | `#F7F8FA` | App background behind cards, table header, hover |
| `--surface` | `#FFFFFF` | Cards, inputs, popovers |
| `--ink` | `#0B0D2A` | Primary text |
| `--mute` | `#5B6078` | Secondary text, helper text, placeholders |
| `--border` | `#E5E7EB` | Soft 1px borders and dividers (decorative only). Named `--line` in code (`border-line`), because shadcn owns `--border` |
| `--border-input` | `#7A8099` | Input, select, checkbox boundaries (3:1) |
| `--blue` | `#0056FF` | Primary actions, links, focus ring (logo blue, D-026) |
| `--on-blue` | `#FFFFFF` | Text on blue |
| `--blue-hover` | `#0047D9` | Primary hover |
| `--blue-active` | `#003BB5` | Primary pressed |
| `--blue-soft` | `#E6EEFF` | Selected rows, active nav item, subtle highlight |
| `--yellow` | `#FFC400` | Tiny highlights, "Coming soon" and "New" badges (text always `--ink`; logo yellow, D-026) |
| `--yellow-soft` | `#FFF6D6` | Gentle emphasis backgrounds |
| `--mint` | `#0A7A53` | Money, success |
| `--mint-soft` | `#E3F6EE` | Success backgrounds |
| `--danger` | `#C42020` | Errors, destructive |
| `--danger-soft` | `#FDECEC` | Error backgrounds |
| `--warning` | `#8A5A00` | Warning text |
| `--warning-soft` | `#FFF3D1` | Warning backgrounds |

### 3.1 Measured contrast (must keep passing)
| Pair | Ratio |
|---|---|
| ink on white / on bg-subtle | 19.0 / 17.9 |
| mute on white / on bg-subtle | 6.2 / 5.8 |
| white on blue | 5.6 |
| blue (links) on white / on bg-subtle | 5.6 / 5.2 |
| blue on blue-soft | 4.8 |
| white on blue-hover / blue-active | 7.2 / 9.2 |
| ink on yellow | 11.9 |
| mint on white / on mint-soft | 5.4 / 4.8 |
| danger on white / on danger-soft | 5.9 / 5.1 |
| warning on white / on warning-soft / on yellow-soft (Test mode badge) | 5.9 / 5.4 / 5.5 |
| border-input on white / on bg-subtle | 3.9 / 3.7 |
| focus ring (blue) on white | 5.6 |

`--border` (1.2:1) is decorative only. Never use it as the only boundary of an input or interactive control.

### 3.2 Usage rules
- **Blue** = the primary action, links, focus. One blue button per view.
- **Yellow** = tiny highlights and "Coming soon" badges. Never body text, never large fills in the app.
- **Mint** = money and success, always with text or an icon.
- **Danger** = errors and destructive actions only.
- Never rely on color alone; add icon or text.
- Forbidden: gradients, glassmorphism, neon, decorative shadows, dark panels in the app.

### 3.3 Charts
Series order: `--blue`, `--mint`, `--ink`, `--mute` (max 4). Direct labels or legend plus markers, gridlines `--border`, axis text `--mute` 12 px, money in tooltips with tabular numerals.

---

## 4. Typography

| Role | Font | Weights |
|---|---|---|
| Headings, big numbers | **Bricolage Grotesque** | 600, 800 |
| Body and UI | **Instrument Sans** | 400, 500, 600 |

Fallbacks: heading `"Bricolage Grotesque","Trebuchet MS",system-ui,sans-serif`; body `"Instrument Sans",system-ui,-apple-system,"Segoe UI",sans-serif`. Load with `next/font` (`display: swap`, subset `latin`).

| Style | Font | Size | Weight | Line height | Tracking |
|---|---|---|---|---|---|
| Display (auth, empty states) | Heading | `clamp(1.75rem, 3vw, 2.25rem)` | 800 | 1.15 | -0.03em |
| H1 (page title) | Heading | 1.75rem | 800 | 1.2 | -0.025em |
| H2 (section) | Heading | 1.375rem | 800 | 1.25 | -0.02em |
| H3 (card title) | Heading | 1.125rem | 600 | 1.3 | -0.01em |
| Body L | Body | 1.0625rem | 400 | 1.6 | 0 |
| Body | Body | 0.9375rem (15px) | 400 | 1.55 | 0 |
| Body S (tables, helper) | Body | 0.875rem | 400 | 1.5 | 0 |
| Caption | Body | 0.8125rem | 500 | 1.4 | 0 |
| Button | Body | 0.9375rem | 600 | 1 | 0 |
| Money L (KPI) | Heading | 2rem | 800 | 1.1 | -0.03em, tabular |
| Money M | Heading | 1.25rem | 800 | 1.2 | tabular |

Rules: sentence case everywhere, no all-caps labels; minimum 13 px; text typed into inputs is 16 px (`text-field`) so phones do not zoom in on focus; max line length 70 to 75 characters; money uses tabular numerals and a currency symbol (`$1,240.00`); links `--blue`, underlined in paragraphs.

---

## 5. Spacing, layout and grid
**Spacing scale (4 px base):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 (`--space-1` to `--space-11`).
**Breakpoints:** base 0 (design at 360 to 390), sm 640, md 768, lg 1024, xl 1280. No horizontal page scroll; wide tables scroll inside their own container.
**App shell:** sidebar 240 px from md (768 px) up, top bar 56 px, content uses the full width next to the sidebar (no max width, D-044) with 24 px padding (16 px mobile), page background `--bg-subtle`, cards white. **Mobile (below md): a fixed bottom tab bar** with the four sections (icon + label, 56 px high, safe-area padding, active item `--blue` text with a 2px top bar) instead of a sheet (D-023, confirmed in D-028); the top bar shows the logo, the page title and the account menu.
**Auth and form pages:** white page, centered column max 420 px (Stan-like), wordmark at the top, progress bar at the page top for multi-step flows.
**Touch targets:** 44 px minimum on mobile (36 px minimum on desktop), 8 px gap between adjacent targets.

---

## 6. Shape, borders and shadows
| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 8px | Badges, checkboxes |
| `--radius-md` | 12px | Inputs, buttons, list rows |
| `--radius-lg` | 16px | Cards, dialogs |
| `--radius-full` | 9999px | Pills, avatars |

**Borders:** cards and dividers 1px `--border`; form controls 1px `--border-input`. **Shadows:** none on cards. Popovers, menus and dialogs only: `0 8px 24px rgb(11 13 42 / 0.12)`. **Focus ring:** `outline: 3px solid var(--blue); outline-offset: 2px` on every focusable element (`:focus-visible`).

---

## 7. Marketing-only motifs
The public marketing landing page (not the app) may use the stall, receipt and coupon motifs (scalloped awning edge, dashed tear lines, hard offset shadows, giant "0%") defined in `LANDING_PAGE_PROMPT_V2.md`. They use the same color tokens and fonts. The dashboard, auth, storefront and checkout stay quiet and white.

---

## 8. Iconography
`lucide-react`, 2px stroke, rounded; sizes 16 (inline), 20 (UI), 24 (nav), 32 (empty states); `currentColor`; accessible name unless decorative. **Exception (D-046):** social platform logos (Instagram, TikTok, Facebook, X, LinkedIn, YouTube) come from `components/brand/social-logos.tsx` (Simple Icons, CC0), only next to a link to the creator's own profile. In the dashboard they use the brand color (`lib/brand-colors.ts`, the only other file allowed raw colors); on the creator's store page they take the theme's text color. Standard map: My Store `Store`, Income `Wallet`, Customers `Users`, Settings `Settings`, Product `Package`, Download `Download`, Link `Link2`, Copy `Copy`, Success `CheckCircle2`, Error `AlertCircle`, Info `Info`, Lock `Lock`, Mail `Mail`, External `ExternalLink`.

---

## 9. Components
Built on shadcn/ui and restyled with tokens. States for every interactive component: default, hover, focus-visible, active, disabled, loading, error.

### 9.1 Button
| Variant | Style |
|---|---|
| Primary | bg `--blue`, text `--on-blue`, radius md. Hover `--blue-hover`, active `--blue-active` |
| Secondary | bg `--surface`, 1px `--border-input`, text `--ink`. Hover bg `--bg-subtle` |
| Ghost | no border, text `--ink`. Hover bg `--bg-subtle` |
| Destructive | bg `--danger`, text white. Only in confirm dialogs |
| Link | text `--blue`, underline |

Sizes: `sm` 36 px (desktop), `md` 44 px (default), `lg` 52 px (checkout, auth primary). Padding 0 20 px; icon gap 8 px. Disabled: 50% opacity, no hover. Loading: spinner replaces icon, width kept, `aria-busy`. **One Primary per view.**

### 9.2 Input, textarea, select
Height 44 px, radius md, bg `--surface`, 1px `--border-input`, text `--ink` at 16 px (`text-field`), placeholder `--mute`. Label above (Caption weight 600), helper below (Body S, `--mute`). Focus: blue ring. Error: border `--danger`, message with icon, `aria-invalid`, `aria-describedby`. Prefix/suffix adornments (for example `pickstall.store/@`) sit inside the field with a `--bg-subtle` prefix block. Never use a placeholder as the label.

### 9.3 Checkbox, radio, switch, segmented control
20 px boxes, radius sm, 1px `--border-input`; checked = `--blue` fill with white check. Switch 44x24. Segmented control (Fixed price | Pay what you want): 1px border, selected segment `--blue-soft` with `--ink` text and a 1px `--blue` border.

### 9.4 Card
bg `--surface`, 1px `--border`, radius lg, padding 20 to 24 px, no shadow. Clickable cards: hover border `--border-input`. Card header: H3 plus optional description (Body S, `--mute`) and an action on the right.

### 9.5 Badge
Radius full, padding 2 px 10 px, Caption 600. Live (`--mint-soft`, `--mint`, check icon), Draft (`--bg-subtle`, `--mute`), Coming soon (`--yellow`, `--ink`), Paid (`--mint-soft`), Refunded (`--danger-soft`, `--danger`), Test mode (`--yellow-soft`, `--warning`), Example (`--bg-subtle`, `--mute`, 1px border). Always include text.

### 9.6 Toast
Bottom-center on mobile, bottom-right on desktop; surface with 1px border and popover shadow; success has a mint icon; errors use `--danger-soft`. Auto-dismiss 5 s (not for errors), pause on hover/focus, `role="status"` (`alert` for errors), max 3 stacked.

### 9.7 Dialog, sheet, popover
Surface, 1px border, radius lg, popover shadow, scrim `rgb(11 13 42 / 0.4)`, max width 480 px (720 px for the type picker). Mobile: bottom sheet. Trap focus, close on Esc, return focus. Destructive confirms name the object and use a Destructive button.

### 9.8 Navigation
Sidebar item: 40 px, radius md, 20 px icon + label; active = `--blue-soft` bg, `--ink` text, medium weight; hover `--bg-subtle`. Tabs: underline style, active 2px `--blue` underline and `--ink` text, inactive `--mute`. Breadcrumb in the top bar (Body S).

### 9.9 Table
Header row on `--bg-subtle`, Caption 600 `--mute`; rows 56 px with 1px `--border` separators; money right-aligned and tabular; hover row `--bg-subtle`; selected row `--blue-soft`. Mobile: stack as cards (label/value pairs). Cursor pagination at the bottom ("Load more"). Sort indicators with `aria-sort`.

### 9.10 Progress, stepper, skeleton
Progress bar 6 px, radius full, track `--border`, fill `--blue`, always with a text value ("Step 1 of 2", "1 of 4 done"). Auth progress bar sits at the very top of the page. Skeleton: `--bg-subtle` blocks with a slow shimmer (off under reduced motion).

### 9.11 Alert / banner
Radius md, 1px border, icon + title + text. Info (`--blue-soft`), Success (`--mint-soft`), Warning (`--warning-soft`), Error (`--danger-soft`). Inline above the affected form.

### 9.12 Empty state
Centered, 32 px icon in a `--blue-soft` circle, H3 title, one sentence, one primary button. Example: "No products yet" / "Add your first product to start selling." / [Add product].

### 9.13 Forms
Single column, 20 to 24 px between fields, group related fields in cards, inline validation on blur, error summary at the top on submit failure, never clear input on error, save buttons show "Saving..." then "Saved" with a check. Unsaved-changes guard on editors.

### 9.14 Code-like values
Order numbers, links and keys use a monospace font at 0.875 rem with a `--bg-subtle` chip background and a Copy icon button.

---

## 10. Page templates

### 10.1 Marketing landing
See `LANDING_PAGE_PROMPT_V2.md`. Not part of the app UI rules.

### 10.2 Dashboard
Sidebar + top bar + content on `--bg-subtle`. Home until setup is done (D-045): greeting card and the setup checklist only (numbered steps, the next one open with its button); the steps themselves run on `/dashboard/setup` with a stepper on top, and other dashboard pages show a slim "Continue setup" bar. Home after setup: greeting, KPI cards (Revenue, Orders, Customers), the Products / Store design / Links / Analytics tabs and the store preview; the store link, Copy and Publish/Unpublish live in Settings > Store. Income: segmented range (Today, 7 days, 30 days), three KPI cards, line chart, recent orders table with a mint "Platform fee $0.00" tag, note "Payments go directly to your payment account. Card processing fees apply." Customers: toolbar (search, product filter, Export CSV), table, right-side drawer for details and checkout answers. Settings: left sub-nav (Store, Payments, Account) with a single-column form card.

### 10.3 Editors (product and store setup)
Two-column on desktop: form column (max 640 px) of stacked cards plus a **sticky live preview** column (phone frame, 340 px). Top bar inside the page: back arrow, title, status badge, **Save draft** (secondary) and **Publish** (primary). Vertical tabs on the left for the product editor (Details, Checkout, After purchase, Settings); on mobile the tabs become a horizontal scroller and the preview moves behind a "Preview" button.

### 10.4 Public storefront (buyer-facing)
White page, single centered column max 560 px, mobile-first. Avatar 72 px, name (H2), bio (Body), social icons 24 px, product cards (cover 16:9 or 1:1, title H3, short description, price Money M, full-width button with the creator's button text), footer "Powered by Pickstall". Uses the creator's theme (section 11). Product page adds a description, a sticky bottom buy button on mobile, and a trust line.

### 10.5 Checkout
One screen, no top navigation. Order summary card (item, price, **Platform fee $0.00**, total), the creator's headline, form fields (name, email, optional phone, creator questions), payment methods block ("Paid securely via Stripe"), a `lg` Primary "Pay" button, full width and sticky on mobile. Errors inline; no data loss on error.

### 10.6 Buyer library
White page, centered column max 720 px, header with wordmark and "Signed in as ..." plus Sign out. Purchase cards: cover thumbnail, title, "by {creator}", purchase date, Primary-small "Download" (or "Open link"); states: "Download limit reached" (disabled with explanation), "Access removed" (refunded). Muted line "Secure links expire after a short time."

### 10.7 Auth (login and signup)
White page, centered column max 420 px (Stan-like), thin progress bar at the page top for signup ("Step 1 of 2"), wordmark above the form, H1 and one-line subtext, fields, full-width `lg` primary button, "or" divider and a secondary "Continue with Google" button, footer link ("Already have an account? Sign in") and a small legal line. The username field shows prefix `pickstall.store/@` and a live preview line ("Your link: pickstall.store/@maya") with a mint check or a danger message. Code step: six large digit boxes (auto-advance, paste support, `autocomplete="one-time-code"`), "Resend code in 0:24" and "Use a different email". Never reveal whether an email exists.

### 10.8 First-run checklist and type picker
**Checklist card:** title "Get started", progress ("1 of 4 done", progress bar), four rows (Store setup, Add your first product, Connect payments, Publish your store), each with a status icon, a one-line description and a chevron button; completed rows show a mint check; the next step row is highlighted with `--blue-soft`. **Type picker (dialog 720 px):** title "What are you selling?", a 3x2 grid of selectable cards (icon, name, one-line description): Digital product (selectable), Course, Coaching call, Membership, Collect emails, Link (each "Coming soon", dimmed, not selectable). Footer: Cancel (ghost), Continue (primary).

---

## 11. Storefront themes (creator-facing)
Themes are data (token sets), not separate code. The creator picks a preset and an accent color.

| Token | Clean (default) | Bold | Soft |
|---|---|---|---|
| Background | `#FFFFFF` | `#FFD84D` | `#FFF1EA` |
| Text | `#0B0D2A` | `#0B0D2A` | `#2B1A17` |
| Muted text | `#5B6078` | `#2B2E55` | `#6B4F47` |
| Default accent | `#0056FF` | `#0B0D2A` | `#C2410C` |
| On accent | `#FFFFFF` | `#FFD84D` | `#FFFFFF` |
| Card | `#F7F8FA` | `#FFFFFF` | `#FFFFFF` |
| Radius | 12px | 8px | 24px |
| Borders and shadow | 1px border, no shadow | 2px ink border, hard offset shadow | no border, soft shadow |

Measured: Clean muted on white 6.2; Bold ink on yellow 13.7 and muted on yellow 9.3; Soft text on bg 15.1, muted on bg 6.7, white on accent 5.2, accent on bg 4.7.
**Accent picker rules:** any accent is allowed, but the system computes `on-accent` (white or ink) and rejects or auto-adjusts accents whose contrast with `on-accent` is below 4.5:1, and shows the result ("Good contrast"). Never allow low-contrast buttons. Button text is creator-defined but limited in length (for example 24 characters) so it never breaks layout.

---

## 12. Motion
Tokens: `--dur-fast` 120 ms, `--dur-base` 200 ms, `--dur-slow` 320 ms, `--ease-out` `cubic-bezier(0.22, 1, 0.36, 1)`. App motion is minimal: hover/focus/press feedback, dialog and toast enter/exit, checklist item completion (check draws in), live preview updates. Animate `transform` and `opacity` only. Under `prefers-reduced-motion: reduce`, remove all non-essential motion. No auto-redirect delays that depend on animation; no looping animation.

---

## 13. Accessibility
WCAG 2.1 AA minimum (contrast verified in section 3.1). Visible focus on every interactive element, logical tab order, skip link, landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, no skipped heading levels. Forms: visible labels, errors linked with `aria-describedby`, `aria-live="polite"` for status. Do not convey information by color alone; icons need names; decorative mockups `aria-hidden`. Drag-and-drop reordering must have a keyboard alternative (move up/down buttons). Support 200% zoom and text spacing overrides.

---

## 14. Imagery
No stock photos of people. Initials avatars (`--blue-soft` circle with `--blue` initials), creator uploads, UI mockups in HTML/CSS/SVG. Cover aspect ratios: 16:9 (course) and 1:1 (download) with an upload hint. Content images have `alt`; decorative images have `alt=""`.

---

## 15. Content and microcopy
Voice: plain, direct, warm, specific. Say what happens and what it costs.
- Buttons: verb + object ("Add product", "Publish store", "Send test email").
- Errors: what happened, why if known, how to fix; never blame the user ("Couldn't save. Check your connection and try again.").
- Empty states: what this is, why it matters, one next action.
- Money: currency symbol, two decimals in tables and receipts; fees labelled explicitly ("Platform fee $0.00", "Card processing set by Stripe").
- Dates: by locale (`Oct 29, 2026`), relative for recent items with the absolute time on hover.
- Every "0%" claim is near "Stripe's card processing fees still apply". "Coming soon" tag on anything not live. No emoji in product UI. No lorem ipsum.
- Checkout-fields editor note: "Answers appear in your Customers tab. Don't ask for card numbers or ID numbers."

---

## 16. Implementation (tokens in code)

### 16.1 Fonts (`app/layout.tsx`)
```ts
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-bricolage", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-instrument", display: "swap" });
```
Tailwind exposes them as `font-display` (headings, money) and `font-sans` (body, the default).

### 16.2 CSS variables (`styles/tokens.css`)
`styles/tokens.css` is the source of truth; this is its light block (D-028). Names that differ from section 3: `--line` = `--border`.
```css
:root {
  color-scheme: light;
  --bg:#FFFFFF; --bg-subtle:#F7F8FA; --surface:#FFFFFF; --ink:#0B0D2A; --mute:#5B6078;
  --line:#E5E7EB; --border-input:#7A8099; --border-strong:#0B0D2A; /* marketing outlines only */
  --blue:#0056FF; --on-blue:#FFFFFF; --blue-hover:#0047D9; --blue-active:#003BB5; --blue-soft:#E6EEFF;
  --yellow:#FFC400; --on-yellow:#0B0D2A; --yellow-soft:#FFF6D6;
  --mint:#0A7A53; --mint-soft:#E3F6EE; --danger:#C42020; --on-danger:#FFFFFF; --danger-soft:#FDECEC;
  --warning:#8A5A00; --warning-soft:#FFF3D1;
  --radius-sm:8px; --radius-md:12px; --radius-lg:16px;
  --shadow-popover:0 8px 24px rgb(11 13 42 / 0.12);
  --shadow-card:0 1px 2px rgb(11 13 42 / .04), 0 8px 24px rgb(11 13 42 / .06); /* auth card only (D-026) */
  --shadow-sm/-md/-lg: hard offset shadows, marketing landing only (section 7);
  --scrim:rgb(11 13 42 / 0.4);
  --dur-fast:120ms; --dur-base:200ms; --dur-slow:320ms;
  --ease-out:cubic-bezier(.22,1,.36,1); --ease-in-out:cubic-bezier(.65,0,.35,1);
}
:focus-visible { outline: 3px solid var(--blue); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
```
`--on-yellow` and `--on-danger` exist so text on those fills has its own token. A dark block also exists but is unused (D-025: white only).

### 16.3 Tailwind (v4, CSS-first) mapping
`app/globals.css` maps every token to a Tailwind name and removes the default palette, so raw colors cannot be used: `bg-bg`, `bg-bg-subtle`, `bg-surface`, `text-ink`, `text-mute`, `border-line` (decorative), `border-input` (controls), `bg-blue`, `bg-blue-soft`, `bg-yellow`, `text-mint`, `text-danger`, `text-warning`, ... Type scale: `text-xs` (Caption), `text-sm` (Body S), `text-base` (Body, 15 px), `text-field` (16 px), `text-body-l`, `text-button`, `text-h3`, `text-h2`, `text-h1`, `text-display`, `text-money-m`, `text-money-l`. Radii `rounded-sm/md/lg/full`; shadow `shadow-popover`. Never raw hex.

### 16.4 shadcn/ui variable mapping
`--background`=`--bg`, `--foreground`=`--ink`, `--card`=`--surface`, `--card-foreground`=`--ink`, `--popover`=`--surface`, `--primary`=`--blue`, `--primary-foreground`=`--on-blue`, `--secondary`=`--surface`, `--muted`=`--bg-subtle`, `--muted-foreground`=`--mute`, `--accent`=`--blue-soft`, `--accent-foreground`=`--ink`, `--destructive`=`--danger`, `--border`=`--line`, `--input`=`--border-input`, `--ring`=`--blue`, `--radius`=`--radius-md`.

### 16.5 Token source of truth and tests
Tokens live in `styles/tokens.css`; creator theme presets in `lib/themes.ts` (typed). A unit test asserts the contrast of every foreground/background pair in section 3.1 and every theme in section 11, and the accent-picker guard.

---

## 17. Do and don't
**Do:** white space, 1px soft borders, one blue primary, honest fee labels, mint money text, labelled example data, calm dashboards, live previews, keyboard alternatives.
**Don't:** gradients, glass, neon, drop shadows on cards, dark panels in the app, emoji icons, all-caps eyebrows, tiny text, color-only status, fake testimonials, stock photos, more than one blue button per view.

---

## 18. Example anatomy (reference)
**Dashboard home (1440):** sidebar 240 | content: H1 "Welcome, Maya" | store-link card ("pickstall.store/@maya", Copy, Draft badge) | checklist card (1 of 4 done) | three KPI cards (Example layout).
**Product editor (1440):** top bar (back, title, Draft badge, Save draft, Publish) | tabs left | form cards center (Basics, Cover, File, Price, Button text) | sticky phone preview right.
**Storefront (390):** avatar, name, bio, icons, three product cards with creator-defined buttons, footer.

---

## 19. Design QA checklist (after every screen)
- [ ] Only tokens used (no raw hex, px radii or shadows)
- [ ] 360 px and 1440 px checked, no horizontal scroll
- [ ] One primary button, button sizes correct, 44 px touch targets on mobile
- [ ] Loading, empty, error and populated states exist
- [ ] Keyboard-only walkthrough works, focus ring visible, labels and `aria` correct
- [ ] Contrast of any new color pair verified (4.5:1 text, 3:1 UI)
- [ ] Reduced motion respected
- [ ] Copy follows section 15, example data labelled, every "0%" has the card-fees note
- [ ] No unrequested dependency, no emoji icons, no stock photos

---

## 20. Changelog
- v2.1 (2026-10-29, D-028): logo colors kept (blue `#0056FF`, yellow `#FFC400`, Clean accent `#0056FF`) and written into sections 3, 3.1, 11 and 16; mobile keeps the bottom tab bar (section 5); input text 16 px; section 16 now mirrors the real token and Tailwind names.
- v2.0: white professional theme (replaces v1.x): new tokens and contrast table, Stan-like auth and form layouts, dashboard shell, editor with live preview, first-run checklist, type picker, storefront themes, creator customization guardrails, light-only Phase 1.
