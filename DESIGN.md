# DESIGN.md: Design system (source of truth for all UI)

> Read this before building or changing any UI. If this file conflicts with a quick idea, this file wins. If something is missing, propose an addition here first, then build.
> Product: Pickstall (final name; read it from `lib/config.ts`, never hardcode). Platform for course creators: store, courses, downloads, checkout.

---

## 0. Rules for Claude Code

1. **Never hardcode a color, font, radius, shadow or spacing value.** Use the tokens in section 16 (CSS variables and Tailwind theme).
2. Every screen must work in **light and dark mode**, at **360px** width, with keyboard only, and with `prefers-reduced-motion`.
3. Reuse components from `components/ui/` (shadcn base, restyled per section 9). Do not create one-off buttons, inputs or cards.
4. Every data view needs **loading, empty, error and populated** states.
5. All demo or example data shown in UI must be labelled **"Example"**.
6. No emoji as icons. Icons come from `lucide-react` (section 8).
7. After building a screen, run the checklist in section 19 and report any failures.

---

## 1. Brand and personality

**Concept:** "Pickstall" means the creator's own picks on their own stall: a small, personal storefront where the creator chooses what to sell and the buyer taps to buy. The "0%" promise is the other half: the creator keeps their full cut. The visual language is **receipts, coupons and perforated cut lines**: dashed dividers with a scissors icon, ticket and receipt shapes with scalloped edges (the same scallop doubles as a market-stall awning edge), hard offset shadows, 2px ink outlines on signature elements (coupons, receipts, marketing mockups). Everyday UI (inputs, cards, secondary buttons) is a clean white page with soft 1px borders. One signature moment per page (the giant "0%" on the landing page; the "You keep" receipt card in the dashboard).

**Personality:** confident, clear, a little playful, trustworthy with money. Premium but not cold. Designed by a designer for creators who live on their phones.

**Voice:** plain words, short sentences, no hype, no jargon, no exclamation spam. See section 15.

---

## 2. Design principles

1. **Money is the hero.** Amounts are large, tabular and unambiguous. Fees are always visible and honest.
2. **Mobile-first.** Creators and buyers arrive from Instagram and TikTok. Design the 390px screen first.
3. **One clear action per screen.** One primary button, everything else secondary.
4. **Clarity over decoration.** Decorative motifs (cut lines, tickets) appear sparingly and never reduce legibility.
5. **Honest UI.** No fake proof, no dark patterns, no hidden fees. Real data or labelled examples only.
6. **Accessible by default.** WCAG 2.1 AA minimum.

---

## 3. Color

### 3.1 Core tokens

Contrast ratios are measured (WCAG formula). "AA text" needs 4.5:1 (3:1 for large text 24px+ or 18.66px+ bold). UI borders and icons need 3:1.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#0C0E24` | Page background (white theme, D-007) |
| `--surface` | `#FFFFFF` | `#171A3A` | Cards, inputs, sheets |
| `--ink` | `#0B0D2A` | `#F1F2FF` | Primary text, strong borders |
| `--mute` | `#555A82` | `#A3A8D0` | Secondary text, helper text |
| `--line` | `#CFD3F5` | `#2A2E57` | Decorative dividers only (not for component borders) |
| `--border-ui` | `#878CB0` | `#6068A0` | Component outlines: inputs, cards, secondary buttons (1px, 3:1 on bg and surface) |
| `--border-strong` | `#0B0D2A` | `#6B76C4` | Emphasis outlines (2px): coupons, receipts, highlight button |
| `--blue` | `#2F3BFF` | `#7D88FF` | Primary actions, links, focus |
| `--on-blue` | `#FFFFFF` | `#0C0E24` | Text on blue |
| `--blue-hover` | `#2430D6` | `#9AA3FF` | Primary hover |
| `--blue-active` | `#1B26B8` | `#B4BBFF` | Primary pressed |
| `--blue-soft` | `#E1E4FF` | `#232857` | Selected rows, subtle highlights |
| `--yellow` | `#FFD84D` | `#FFD84D` | Highlights, coupons, badges (text on it is always `#0B0D2A`) |
| `--yellow-soft` | `#FFF3BF` | `#3A3310` | Warning-ish emphasis backgrounds |
| `--mint` | `#0A7A53` | `#4FD6A0` | Money, success, "$0 fee" |
| `--mint-soft` | `#DDF5EA` | `#12332B` | Success backgrounds |
| `--danger` | `#C42020` | `#FF7A7A` | Errors, destructive actions |
| `--danger-soft` | `#FDE3E3` | `#3A1A2A` | Error backgrounds |
| `--warning` | `#8A5A00` | `#FFD84D` | Warning text |
| `--warning-soft` | `#FFF1C2` | `#3A3310` | Warning backgrounds |

### 3.2 Measured contrast (must keep passing)

| Pair | Ratio | Use |
|---|---|---|
| ink on bg (light) | 19.0 | Body text |
| mute on bg (light) | 6.6 | Secondary text |
| white on blue (light) | 6.6 | Primary button |
| blue on bg (light) | 6.6 | Links |
| ink on yellow | 13.7 | Badges, coupons |
| mint `#0A7A53` on white / on bg | 5.4 / 5.4 | Money text |
| danger on white (light) | 5.9 | Errors |
| warning text on white (light) | 5.9 | Warnings |
| ink on bg (dark) | 17.1 | Body text |
| mute on card (dark) | 7.3 | Secondary text |
| on-blue on blue (dark) | 6.2 | Primary button (dark) |
| mint on card (dark) | 9.2 | Money text |
| border-ui `#878CB0` on white (light) | 3.3 | Component outlines (light) |
| border-ui `#6068A0` on dark bg / card | 3.6 / 3.2 | Component outlines (dark) |
| border-strong `#6B76C4` on dark bg / card | 4.5 / 4.0 | Emphasis outlines (dark) |

Note: the old mint `#0C8A5F` failed AA for small text (4.4 on white, 4.0 on bg). Use `#0A7A53`.

### 3.3 Usage rules

- **Blue** = the primary action and links only. One blue button per view.
- **Yellow** = highlight, coupon, "new", the hero accent. Never for body text, never as a button on a light bg without an ink outline.
- **Mint** = money and success. Always paired with text or an icon, never color alone.
- **Danger** = errors and destructive actions only.
- Never use color alone to convey meaning (add icon or text).
- Forbidden: purple-pink gradients, rainbow gradients, glassmorphism, neon glow, decorative gradient washes.
- A single optional gradient is allowed only for the Open Graph image, flat otherwise.

### 3.4 Data visualization palette

Order for series: `--blue`, `--mint`, `--yellow` (with ink outline), `--ink`, `--mute`. Max 5 series. Always add direct labels or a legend plus patterns or markers (do not rely on color only). Gridlines use `--line`. Axis text uses `--mute` at 12px. Money values in tooltips use tabular numerals.

---

## 4. Typography

### 4.1 Fonts

| Role | Font | Weights | Notes |
|---|---|---|---|
| Display / headings | **Bricolage Grotesque** (variable, optical size axis) | 600, 800 | Tight tracking, large scale |
| Body / UI | **Instrument Sans** | 400, 500, 600 | Tabular numerals for money (`font-variant-numeric: tabular-nums`) |
| Code / license keys (optional) | System mono | 500 | Only for keys, IDs |

Fallbacks: display `"Bricolage Grotesque","Trebuchet MS",system-ui,sans-serif`; body `"Instrument Sans",system-ui,-apple-system,"Segoe UI",sans-serif`.
Load with `next/font` (self-hosted, `display: swap`, subsets `latin`), no layout shift.

### 4.2 Type scale

| Style | Font | Size (clamp) | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|---|
| Display XL | Display | `clamp(2.8rem, 7.4vw, 5.6rem)` | 800 | 0.95 | -0.045em | Landing hero H1 |
| Display L | Display | `clamp(2rem, 5vw, 3.4rem)` | 800 | 1.0 | -0.035em | Section headings (marketing) |
| H1 | Display | `clamp(1.75rem, 3vw, 2.25rem)` | 800 | 1.1 | -0.03em | Page title (app) |
| H2 | Display | 1.5rem | 800 | 1.2 | -0.02em | Section title (app) |
| H3 | Display | 1.25rem | 600 | 1.3 | -0.015em | Card title |
| H4 | Display | 1.0625rem | 600 | 1.35 | -0.01em | Subsection |
| Body L | Body | 1.25rem | 400 | 1.55 | 0 | Marketing lead |
| Body | Body | 1.0625rem (17px) | 400 | 1.6 | 0 | Default text |
| Body S | Body | 0.9375rem (15px) | 400 | 1.5 | 0 | Table cells, helper text |
| Caption | Body | 0.8125rem (13px) | 500 | 1.4 | 0 | Labels, meta (minimum size) |
| Button | Body | 1rem | 600 | 1 | 0 | Buttons |
| Money L | Display | `clamp(2rem, 4vw, 3rem)` | 800 | 1.05 | -0.04em | KPI amounts, tabular |
| Money M | Display | 1.5rem | 800 | 1.1 | -0.03em | Card amounts |

### 4.3 Typography rules

- Sentence case everywhere. **No all-caps labels or eyebrows.**
- Max line length 70-75 characters for paragraphs.
- Never go below 13px. Body default is 17px on marketing, 16px minimum in dense app tables.
- Left-align text (center only short hero blocks and empty states).
- Numbers: tabular, with thousands separators, currency symbol before the amount (`$1,240.00`, `£1,240.00`). Show two decimals for amounts in tables and receipts, none for large KPI amounts.
- Link style: `--blue`, underlined on hover and always underlined inside paragraphs.
- Do not use more than 2 font families on a screen.

---

## 5. Spacing, layout and grid

### 5.1 Spacing scale (4px base)

`--space-1` 4px, `-2` 8px, `-3` 12px, `-4` 16px, `-5` 20px, `-6` 24px, `-8` 32px, `-10` 40px, `-12` 48px, `-16` 64px, `-20` 80px, `-24` 96px.
Component inner padding: 12-16px (compact), 20-24px (cards). Marketing section vertical padding: 64px mobile, 96px desktop.

### 5.2 Breakpoints and containers

| Name | Min width | Container max | Columns |
|---|---|---|---|
| base | 0 (design at 360-390) | 100%, 20px side padding | 4 |
| sm | 640px | 100% | 6 |
| md | 768px | 720px | 8 |
| lg | 1024px | 960px | 12 |
| xl | 1280px | 1120px | 12 |
| 2xl | 1440px | 1120px (marketing) / fluid (dashboard) | 12 |

No horizontal page scroll at any width. Wide tables scroll inside their own container.

### 5.3 App shell

- Sidebar 248px (desktop, collapsible to 72px icon rail), becomes a bottom tab bar or a sheet on mobile.
- Top bar 64px: store name, "View store", avatar menu.
- Content max width 1200px, 24px padding (16px mobile).
- Safe areas: respect `env(safe-area-inset-*)` on fixed bars.

### 5.4 Touch and click targets

Minimum 44x44px for tappable elements on mobile; 40px minimum on desktop. 8px minimum gap between adjacent targets.

---

## 6. Shape, borders and shadows

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 6px | Badges, checkboxes |
| `--radius-sm` | 10px | Inputs, small buttons |
| `--radius-md` | 14px | Buttons, list items |
| `--radius-lg` | 20px | Cards |
| `--radius-xl` | 28px | Hero panels, large containers |
| `--radius-full` | 9999px | Pills, avatars |

**Borders:** component outlines (inputs, cards, secondary buttons, alerts) are **1px** `--border-ui`, which keeps 3:1 contrast. `--border-strong` (2px) is for emphasis only: coupons, receipts, the highlight button. Decorative dividers are 1px `--line`. Dashed borders (2px dashed `--border-strong`) are reserved for coupons and cut lines.

**Shadows (hard offset, no blur):**
- `--shadow-sm`: `3px 3px 0 var(--border-strong)` (hover lift on small items)
- `--shadow-md`: `6px 6px 0 var(--border-strong)` (cards in marketing)
- `--shadow-lg`: `14px 14px 0 var(--blue)` (hero mockups)
- Overlays (menus, popovers, dialogs) may use a soft shadow: `0 12px 32px rgb(11 13 42 / 0.18)` (light) or `0 12px 32px rgb(0 0 0 / 0.5)` (dark).
- Dashboard cards use border only (no shadow) to stay calm.

**Focus ring:** `outline: 3px solid var(--blue); outline-offset: 3px;` on every focusable element (`:focus-visible`).

---

## 7. Signature motifs (use sparingly)

### 7.1 Cut line (section divider)
A 2px dashed `--border-strong` line with a scissors icon (lucide `Scissors`, 20px) sitting on the line, 24px from the left, with a `--bg` pad behind the icon. Used between major marketing sections and above the dashboard "payout" summary. Not used more than once per viewport.

```css
.cut-line { position: relative; border-top: 2px dashed var(--border-strong); margin: 0; }
.cut-line > svg { position: absolute; top: -10px; left: 24px; background: var(--bg); padding: 0 8px; }
```

### 7.2 Ticket / coupon
Rounded 12px box, 2px dashed border, yellow fill, ink text. Left text = code (`SPRING20`), right text = value (`20% off`). Optional notches (semicircle cutouts) on the left and right edges.

### 7.3 Receipt
White card, 2px ink outline, scalloped bottom edge (radial-gradient repeating semicircles), line items separated by 1px dashed `--line`. Total in Display font. Used for: landing hero ("Platform fee $0.00"), order detail, checkout summary.

```css
.receipt { position: relative; background: var(--surface); border: 2px solid var(--border-strong); border-radius: 12px 12px 0 0; }
.receipt::after { content: ""; position: absolute; left: -2px; right: -2px; bottom: -9px; height: 9px;
  background: radial-gradient(circle at 8px 0, transparent 6px, var(--surface) 6.5px) 0 0 / 16px 9px repeat-x; }
```

### 7.4 The "0%" moment
Marketing hero only: giant "0%" in Display XL inside a perforated ticket shape. The "$0 platform fee" mint line appears on receipts and in the dashboard order list. Do not repeat the giant numeral elsewhere.

---

## 8. Iconography

- Library: `lucide-react`. Stroke 2px, rounded caps and joins.
- Sizes: 16px (inline), 20px (default UI), 24px (nav, feature tiles), 32px (empty states).
- Color: `currentColor` (inherit text color). Mint only for success, danger only for errors.
- Always provide an accessible name (`aria-label`) unless purely decorative (`aria-hidden`).
- Standard map: Store `Store`, Course `GraduationCap`, Download `Download`, Coupon `Ticket`, Orders `Receipt`, Students `Users`, Email `Mail`, Analytics `LineChart`, Settings `Settings`, Payments `CreditCard`, Link `Link2`, Cut `Scissors`, Success `CheckCircle2`, Error `AlertCircle`, Info `Info`.

---

## 9. Components

All built on shadcn/ui primitives, restyled with tokens. States for every interactive component: default, hover, focus-visible, active, disabled, loading, error (where relevant).

### 9.1 Button
| Variant | Style |
|---|---|
| Primary | bg `--blue`, text `--on-blue`, no outline, radius md. Hover `--blue-hover`, active `--blue-active` |
| Secondary | bg `--surface`, 1px `--border-ui`, text `--ink`. Hover: bg `--blue-soft` |
| Ghost | no bg or border, text `--ink`. Hover `--blue-soft` |
| Destructive | bg `--danger`, text white. Only inside confirm dialogs |
| Highlight | bg `--yellow`, text `#0B0D2A`, 2px `#0B0D2A` outline. Marketing only |
| Link | text `--blue`, underline |

Sizes: `sm` 36px (desktop only), `md` 44px (default), `lg` 52px (hero/checkout). Padding 0 20px, font Button style, icon gap 8px. Disabled: 50% opacity, `cursor: not-allowed`, no hover. Loading: spinner replaces icon, label stays, button keeps width, `aria-busy="true"`.
Rule: **one Primary per view**. Checkout "Pay" button is `lg`, full width on mobile, sticky at bottom.

### 9.2 Input, textarea, select
Height 48px, radius sm, bg `--surface`, 1px `--border-ui`, text `--ink`, placeholder `--mute`. Label above (Caption weight 600), helper text below (Body S, `--mute`). Focus: blue ring. Error: border `--danger`, message with icon in `--danger`, `aria-invalid` and `aria-describedby`. Never rely on placeholder as label.

### 9.3 Checkbox, radio, switch
20px boxes, radius xs, 1px `--border-ui` border; checked = `--blue` fill with white check. Switch 44x24, thumb 18px, on = `--blue`. Label text is part of the click target.

### 9.4 Card
bg `--surface`, 1px `--border-ui`, radius lg, padding 20-24px. Hover (only if clickable): bg `--blue-soft`. No nested cards deeper than 1 level.

### 9.5 Badge / tag
Radius full, padding 2px 10px, Caption weight 600. Variants: Live (mint-soft bg, mint text, check icon), Draft (blue-soft, ink), Coming soon (yellow, ink), Refunded (danger-soft, danger), Example (line outline, mute). Always include text.

### 9.6 Toast
Bottom-center on mobile, bottom-right on desktop. Yellow for sale celebration ("New sale: Budgeting 101, $49"), surface for neutral, danger-soft for errors. Auto-dismiss 5s (not for errors), pause on hover/focus, `role="status"` (or `alert` for errors). Max 3 stacked.

### 9.7 Dialog, sheet, popover
Dialog: surface, 1px `--border-ui` border, radius xl, max width 480px, scrim `rgb(11 13 42 / 0.5)`. Mobile: bottom sheet with 28px top radius. Trap focus, close on Esc, return focus to trigger. Destructive confirms name the object ("Delete Budgeting 101?") and use a Destructive button.

### 9.8 Tabs and navigation
Tabs: underline style, active = 3px `--blue` underline + ink text; inactive `--mute`. Sidebar item: 44px, radius md, icon 20px + label; active = `--blue-soft` bg + ink text + 3px blue left bar. Mobile bottom bar max 5 items.

### 9.9 Table
Header row Caption weight 600 `--mute`, 1px `--line` row separators, row height 56px, cell padding 12-16px, money right-aligned and tabular. Hover row `--blue-soft`. Mobile: stack as cards (label/value pairs). Sorting indicators with icons and `aria-sort`.

### 9.10 Progress, stepper, skeleton
Progress bar 10px, radius full, track `--line`, fill `--blue`; always show a text value. Stepper: numbered circles only for true sequences (onboarding). Skeleton: `--line` blocks with a slow shimmer (disabled under reduced motion).

### 9.11 Alert / banner
Radius md, 1px border (variant color), icon + title + text. Info (blue-soft), Success (mint-soft), Warning (warning-soft), Error (danger-soft). Inline above the affected form, not floating.

### 9.12 Empty state
Centered, 32px icon in a `--blue-soft` circle, H3 title, one sentence, one primary button. Example: "No products yet" / "Add your first course or download to start selling." / [Add product].

### 9.13 Forms
Single column, 24px between fields, group related fields, inline validation on blur, summary of errors at the top when submit fails, never clear user input on error. Save buttons show "Saving..." then "Saved" with a check.

### 9.14 Charts
Inline SVG or a light chart library. 2px lines, rounded joins, no 3D, no gradients, direct labels on the last point, hover/focus tooltip with exact values. Provide a data table alternative for screen readers.

---

## 10. Page templates

### 10.1 Marketing landing (see `LANDING_PAGE_PROMPT.md` for copy)
Order: announcement bar, sticky nav, hero (giant 0%), payments strip, fee explainer + calculator, no-code steps, feature bento, benefits, dashboard preview, student experience, who it is for, compare, pricing, founder note, FAQ, final CTA, footer. Cut line between major sections. One orchestrated motion on load.

### 10.2 App dashboard
Sidebar + top bar + content. Four sections: My Store, Income, Customers, Settings (D-011). My Store opens first and holds the first-run checklist (10.8). The overview (greeting, 3 KPI cards, revenue chart, recent orders with the mint "$0 platform fee" tag) lives in Income. Lists use tables on desktop and cards on mobile.

### 10.3 Builders (course, store, funnel, email flow)
Three-panel layout on desktop: structure (left, 280px), editor (center, fluid), settings and preview (right, 340px). On mobile: tabs (Structure, Edit, Settings). Autosave with visible status. Publish is the single Primary button, top right.

### 10.4 Public storefront (buyer-facing)
Mobile-first, one column, max width 560px centered on desktop. Avatar, name, bio, social links, product cards, optional email capture block. Sticky Buy button on product pages. Footer: "Powered by [Brand]" (removable on Pro) and creator policies.

### 10.5 Checkout
Order summary receipt on top, order bump checkbox, coupon field (collapsed link "Have a code?"), payment buttons (Apple Pay / Google Pay / card via Stripe), trust line "Paid securely via Stripe". One screen, no distractions, no top nav.

### 10.6 Student area
Library grid, then course player: video (16:9), lesson title, tabs (Overview, Notes, Downloads), "Mark complete", sidebar with modules and checkmarks, progress bar. Distraction-free, calm.

### 10.7 Login and signup
White page, one centered column, no card: wordmark, H1, one short line of help text, fields, one primary button (D-007, D-008). Fields have leading icons (decoration only) and always a visible label. Signup is two steps, details and then the 6-digit email code, with a thin progress bar that always has a text value ("Step 1 of 2"). The Google button is secondary and only shown when Google is set up; new Google users get one extra step to choose a username. Errors are inline under the field (icon + text), focus moves to the first invalid field, typed values are never cleared. The code step auto-submits at 6 digits and offers "Resend code" with a cooldown and "Use a different email". No emoji, no activation page.

### 10.8 Dashboard first-run checklist and product customization
- **First-run checklist** (My Store): Store setup, Add first product, Connect payments, Publish (D-009). Each item shows done or not done with an icon and text (never color alone); the primary button is the next undone item.
- **Type picker:** a grid of type cards. The live type (Digital product) is selectable; the others (Course, Coaching call, Membership, Collect emails, Link) carry the "Coming soon" badge (9.5) and are not clickable (D-012).
- **Customization forms** (D-013): single column (9.13) inside the builder layout (10.3). Length-limited text shows a character counter. Email variables ({{customer_name}}, {{product_title}}, {{download_link}}) appear as chips next to the field; the download link note says it is always included. The accent color picker shows the contrast check result (section 11).
- **Checkout questions:** a list of up to 5 questions, each with type, required toggle and order controls; the add button is disabled with an explanation at 5. No sensitive questions (D-014).
- **Customers panel:** a table (email, name, phone, date, answers) that stacks into cards on mobile (9.9); "Export CSV" is a secondary button.

---

## 11. Storefront themes (creator-facing)

Creators pick a preset and an accent color. Themes are **data** (token sets), not separate code.

| Token | Clean (default) | Bold | Soft |
|---|---|---|---|
| Background | `#FFFFFF` | `#FFD84D` | `#FFF1EA` |
| Text | `#111322` | `#0B0D2A` | `#2B1A17` |
| Muted text | `#5B6078` | `#2B2E55` | `#6B4F47` |
| Default accent | `#2F3BFF` | `#0B0D2A` | `#C2410C` |
| On accent | `#FFFFFF` | `#FFD84D` | `#FFFFFF` |
| Card | `#F2F3FF` | `#FFFFFF` | `#FFFFFF` |
| Radius | 14px | 8px | 24px |
| Borders and shadow | 1px line, no shadow | 2px ink, hard offset shadow | no border, soft shadow |
| Display font | Bricolage 800 | Bricolage 800 | Bricolage 600 |

Measured: Bold accent pair (yellow on ink) 13.7; Soft on-accent (white on `#C2410C`) 5.2; Soft text on bg 15.1; Clean muted on white 6.2.

**Accent color picker rules:** the creator may pick any accent. The system computes `on-accent` (white or ink) and **rejects or auto-adjusts** accents whose contrast with `on-accent` is below 4.5:1. Show the check result in the picker. Never allow low-contrast buttons.

---

## 12. Motion

| Token | Value |
|---|---|
| `--dur-fast` | 120ms |
| `--dur-base` | 200ms |
| `--dur-slow` | 360ms |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` |

- Hover, focus and press feedback: `--dur-fast`, transform and color only.
- Page and section motion is rare: **one orchestrated hero sequence** on the landing page; scroll-linked progress for the "how it works" steps. No fade-up on every section.
- Sale toasts and receipt "print" animation are allowed celebratory motion (once per event).
- Animate `transform` and `opacity` only. No layout-shifting animations.
- Under `prefers-reduced-motion: reduce`: remove all non-essential motion, keep instant state changes.
- No autoplaying looping video or marquee.

---

## 13. Accessibility

- WCAG 2.1 AA minimum. Text 4.5:1, large text and UI components 3:1 (verified in section 3.2).
- Visible focus on every interactive element. Logical tab order. Skip link to main content.
- Landmarks: `header`, `nav`, `main`, `footer`; one `h1` per page; no skipped heading levels.
- Forms: visible labels, error text linked with `aria-describedby`, `aria-live="polite"` for status.
- Do not convey information by color alone. Icons need names. Decorative mockups use `aria-hidden`.
- Video lessons: captions field and transcript support in the course builder (P1), keyboard-operable player.
- Support 200% zoom and text spacing overrides without loss of content.
- Dark mode follows the OS by default with a user override; both themes must pass contrast checks.

---

## 14. Imagery and illustration

- No stock photos of people. Use initials avatars (colored circle, `--yellow` or `--blue-soft`), creator-uploaded images, and UI mockups built in HTML/CSS/SVG.
- Product cover aspect ratio 16:9 (course) and 1:1 (download). Show an upload hint with required size.
- Open Graph image: 1200x630, flat, ink background, yellow and blue shapes, brand wordmark, one headline.
- Illustrations (if any): flat vector, 2px ink outline, palette tokens only, no gradients.
- Always `alt` text on content images; empty `alt=""` on decorative.

---

## 15. Content and microcopy

**Voice:** direct, warm, specific. Say what happens and what it costs.

| Do | Don't |
|---|---|
| "Connect Stripe to start getting paid" | "Unlock the power of payments" |
| "Your store is live. Share this link." | "Congratulations!!! Amazing!" |
| "We don't take a cut of your sales. Stripe's card processing fees still apply." | "100% free forever" |
| "Couldn't save. Check your connection and try again." | "Error 500" |

- Buttons: verb + object ("Add product", "Publish store", "Send receipt").
- Errors: what happened, why if known, how to fix. Never blame the user.
- Empty states: what this is, why it matters, one next action.
- Money: always show currency symbol and two decimals in tables. Label fees explicitly ("Platform fee $0.00", "Card processing set by Stripe").
- Dates: `Oct 24, 2026` (US/CA), `24 Oct 2026` (UK), by store locale. Relative time for recent items ("2 hours ago") with absolute time on hover.
- No emoji in product UI. Marketing may use none either.
- Placeholder text: realistic short examples, never lorem ipsum.
- Every "0%" claim is accompanied by "Stripe's card processing fees still apply".
- "Coming soon" tag on any feature that is not live. Never advertise unshipped features as available.

---

## 16. Implementation (tokens in code)

### 16.1 Fonts (`app/layout.tsx`)
```ts
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";

export const display = Bricolage_Grotesque({
  subsets: ["latin"], weight: ["600", "800"], variable: "--font-display", display: "swap",
}); // verify optical-size axis options in the next/font docs for your version
export const body = Instrument_Sans({
  subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap",
});
// <html className={`${display.variable} ${body.variable}`}>
```

### 16.2 CSS variables (`app/globals.css`)
```css
:root {
  --bg:#FFFFFF; --surface:#FFFFFF; --ink:#0B0D2A; --mute:#555A82; --line:#CFD3F5; --border-ui:#878CB0; --border-strong:#0B0D2A;
  --blue:#2F3BFF; --on-blue:#FFFFFF; --blue-hover:#2430D6; --blue-active:#1B26B8; --blue-soft:#E1E4FF;
  --yellow:#FFD84D; --yellow-soft:#FFF3BF;
  --mint:#0A7A53; --mint-soft:#DDF5EA;
  --danger:#C42020; --danger-soft:#FDE3E3; --warning:#8A5A00; --warning-soft:#FFF1C2;
  --radius-xs:6px; --radius-sm:10px; --radius-md:14px; --radius-lg:20px; --radius-xl:28px;
  --shadow-sm:3px 3px 0 var(--border-strong); --shadow-md:6px 6px 0 var(--border-strong); --shadow-lg:14px 14px 0 var(--blue);
  --dur-fast:120ms; --dur-base:200ms; --dur-slow:360ms; --ease-out:cubic-bezier(.22,1,.36,1);
}
.dark, :root[data-theme="dark"] {
  --bg:#0C0E24; --surface:#171A3A; --ink:#F1F2FF; --mute:#A3A8D0; --line:#2A2E57; --border-ui:#6068A0; --border-strong:#6B76C4;
  --blue:#7D88FF; --on-blue:#0C0E24; --blue-hover:#9AA3FF; --blue-active:#B4BBFF; --blue-soft:#232857;
  --yellow-soft:#3A3310; --mint:#4FD6A0; --mint-soft:#12332B;
  --danger:#FF7A7A; --danger-soft:#3A1A2A; --warning:#FFD84D; --warning-soft:#3A3310;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* repeat the .dark values */ } }
@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
:focus-visible { outline: 3px solid var(--blue); outline-offset: 3px; border-radius: 4px; }
```
Implement the dark values once (a single source) and reuse them for both the media query and the class, for example with a shared mixin or by generating from one tokens file.

### 16.3 Tailwind mapping (Tailwind v4, CSS-first)
```css
@theme inline {
  --color-bg: var(--bg); --color-surface: var(--surface); --color-ink: var(--ink); --color-mute: var(--mute);
  --color-line: var(--line); --color-blue: var(--blue); --color-yellow: var(--yellow); --color-mint: var(--mint);
  --color-danger: var(--danger);
  --font-display: var(--font-display), "Trebuchet MS", system-ui, sans-serif;
  --font-sans: var(--font-body), system-ui, -apple-system, "Segoe UI", sans-serif;
  --radius-md: var(--radius-md); --radius-lg: var(--radius-lg);
}
```
(Tailwind v3: map the same names in `tailwind.config.ts` under `theme.extend.colors/fontFamily/borderRadius`.) Use classes like `bg-bg text-ink border-2 border-ink rounded-lg`, never raw hex.

### 16.4 shadcn/ui variable mapping
`--background`=`--bg`, `--foreground`=`--ink`, `--card`=`--surface`, `--card-foreground`=`--ink`, `--primary`=`--blue`, `--primary-foreground`=`--on-blue`, `--secondary`=`--surface`, `--muted`=`--blue-soft`, `--muted-foreground`=`--mute`, `--accent`=`--yellow`, `--accent-foreground`=`#0B0D2A`, `--destructive`=`--danger`, `--border`=`--border-ui`, `--input`=`--border-ui`, `--ring`=`--blue`, `--radius`=`--radius-md`.

### 16.5 Token source of truth
Keep tokens in `styles/tokens.css` (imported by `globals.css`) and mirror creator themes in `lib/themes.ts` (typed). A unit test must assert the contrast of every foreground/background token pair in section 3.2 and every theme preset in section 11.

---

## 17. Do and don't

**Do:** soft 1px borders on a white page, 2px ink outlines and hard offset shadows only on signature elements and marketing mockups, big confident type, honest fee labels, mint money text, labelled example data, calm dashboards, one primary action.

**Don't:** gradients, glass, neon, soft blurry card shadows in the dashboard, emoji icons, all-caps eyebrows, identical card grids everywhere, fade-up on every section, tiny text, color-only status, fake testimonials, stock photos, lorem ipsum, more than one blue button per view.

---

## 18. Example screen anatomy (reference)

**Dashboard overview (desktop 1440):** sidebar 248px | content: H1 "Good morning, Maya" | row of 3 KPI cards (Revenue 7 days, Orders, Conversion) with Money L numbers and a small trend badge | revenue chart card (2/3 width) + "Get started" checklist card (1/3) | recent orders table with a mint "$0 platform fee" tag per row | "Example data" badge until real data exists.

**Mobile storefront (390):** avatar 72px, name H2, bio Body S, social icons 24px, product cards (cover 16:9, title H3, price Money M, Buy button), sticky bottom CTA on the product page.

---

## 19. Design QA checklist (run after every screen)

- [ ] Only tokens used (no raw hex, px radii or shadows)
- [ ] Light and dark mode both checked
- [ ] 360px and 1440px layouts checked, no horizontal scroll
- [ ] One primary button, correct button sizes, 44px touch targets
- [ ] Loading, empty, error and populated states exist
- [ ] Keyboard-only walkthrough works; focus ring visible; labels and `aria` correct
- [ ] Contrast of any new color pair verified (>= 4.5:1 text, 3:1 UI)
- [ ] Reduced motion respected
- [ ] Copy follows section 15; example data labelled; every "0%" has the Stripe-fees note
- [ ] No unrequested dependency, no emoji icons, no stock photos

---

## 20. Change log

- v1.2: documented the login and signup pattern (10.7), the dashboard sections, first-run checklist, type picker and customization patterns (10.2, 10.8). No token changes (D-008 to D-013).
- v1.1: white theme (`--bg` #FFFFFF), new `--border-ui` token, soft 1px component borders; `--border-strong` kept for emphasis (decision D-007).
- v1.0: initial design system (tokens, typography, components, themes, motion, accessibility, implementation).
