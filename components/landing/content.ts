// Copy for the marketing landing (D-039). Honesty rules: only what is built is shown as live, and
// which plan has it follows PLAN_LIMITS (lib/plans/catalog.ts); anything not built yet is tagged
// "Coming soon"; every 0% claim sits near the card-processing note (DESIGN.md 15).

import { PLAN_LIMITS, PLANNED_PRICE_CENTS, TRIAL_DAYS } from "@/lib/config";
import { formatWholeDollars } from "@/lib/landing/demo";

/** Real pages (D-134), so search and answer engines find a page per topic; the home page keeps its sections. */
export const LANDING_NAV = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/compare/stan-store", label: "Vs Stan Store" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
] as const;

export const CARD_FEES_NOTE = "PayPal's processing fees still apply.";

export const STEPS = [
  { title: "Claim your link", body: "Pick a username. Your stall lives at one short link you can put in any bio." },
  { title: "Make it yours", body: "Photo, bio, social links, a theme and your own accent color. No code, no designer." },
  { title: "Add what you sell", body: "Guides, templates, courses, coaching calls or a free download. Set a price, and add a discount when you like." },
  { title: "Connect payments and share", body: "Buyers pay into your own PayPal account. You see every order, customer and dollar." },
] as const;

/** Not built yet (everything else on the page is live). */
export const COMING_SOON = ["Custom domain", "Memberships", "Payment plans", "Team accounts", "Public API"] as const;

/**
 * Stan Store's public plans, from Stan's own help center (help.stan.store, "Creator vs Creator Pro"
 * and "Creator Pro features", last updated June 2026), checked 2026-11-01. Only facts from those
 * pages: nothing about Stan's fees or trial, because they are not stated there. Re-check before
 * changing any number.
 */
export const STAN = {
  name: "Stan Store",
  source: "help.stan.store",
  checkedOn: "November 1, 2026",
  creatorCents: 2900,
  creatorProCents: 9900,
} as const;

const price = (cents: number) => formatWholeDollars(cents);
const STARTER = price(PLANNED_PRICE_CENTS.starter);
const PRO = price(PLANNED_PRICE_CENTS.pro);

export const FAQ = [
  {
    q: "What is Pickstall?",
    a: "Pickstall is a link-in-bio store where creators sell digital products, online courses and coaching calls from one mobile page, with 0% transaction fees. You put one link in your Instagram, TikTok or YouTube bio, and followers buy in a few taps.",
  },
  {
    q: "What does 0% transaction fees mean?",
    a: "We never take a percentage of your sales. Buyers pay into your own PayPal account. PayPal's processing fees still apply, as they do everywhere.",
  },
  {
    q: "What does it cost?",
    a: `Every new store starts with a ${TRIAL_DAYS}-day free trial, no card needed. Founding creators (the first 10) get 6 months free. After that, plans are ${STARTER} a month (Starter) and ${PRO} a month (Pro), with 0% transaction fees. If you don't pick a plan when the free period ends, your store pauses (nothing is deleted) until you do.`,
  },
  {
    q: "How is Pickstall different from Stan Store?",
    a: `Same kind of creator store, at a lower price. ${STAN.name}'s plans are ${price(STAN.creatorCents)} and ${price(STAN.creatorProCents)} a month; ours are ${STARTER} and ${PRO}, and founding creators pay nothing for 6 months. Storefront, digital products, courses, coaching calls, discount codes, order bumps, upsells, email marketing and affiliate tracking are live today. Memberships and custom domains are on the way and marked Coming soon.`,
  },
  {
    q: "Do I need to code or design?",
    a: "No. You fill in your details, pick a theme and add products. Your stall works on every phone out of the box.",
  },
  {
    q: "How do I get paid?",
    a: "You connect your own PayPal Business account. Money goes straight to it; Pickstall never holds or forwards your funds.",
  },
  {
    q: "Who handles taxes?",
    a: "You do, as the seller. Pickstall is not a merchant of record and does not collect or file sales tax or VAT for you.",
  },
  {
    q: "What can I sell today?",
    a: "Digital products (guides, templates, presets, workbooks), online courses with video, quizzes and certificates, 1:1 coaching calls with booking, and free downloads that grow your email list. Add coupons, order bumps and upsells to sell more. Memberships are coming soon.",
  },
  {
    q: "How do my buyers get their purchase?",
    a: "After a verified payment they get an email with a private link and a library where they can open their purchases any time.",
  },
  {
    q: "Which countries?",
    a: "We start with creators selling to buyers in the US, UK and Canada. Creators elsewhere can join where PayPal supports them.",
  },
] as const;

export type CompareRow = {
  feature: string;
  /** Which Stan Store plan includes it. */
  stan: "Creator" | "Creator Pro";
  /** Live today on Pickstall, or on the roadmap. */
  status: "live" | "soon";
  /** The Pickstall plan that includes it (PRD F9, PLAN_LIMITS). */
  plan: "starter" | "pro";
};

export const COMPARE_ROWS: readonly CompareRow[] = [
  { feature: "Mobile storefront at your own link", stan: "Creator", status: "live", plan: "starter" },
  { feature: "Sell digital products", stan: "Creator", status: "live", plan: "starter" },
  { feature: "Sales and customer analytics", stan: "Creator", status: "live", plan: "starter" },
  { feature: "Online courses", stan: "Creator", status: "live", plan: "starter" },
  { feature: "Lead magnets and email collection", stan: "Creator", status: "live", plan: "starter" },
  { feature: "Discount codes", stan: "Creator Pro", status: "live", plan: "starter" },
  { feature: "Order bumps", stan: "Creator Pro", status: "live", plan: "starter" },
  { feature: "Ad pixel tracking", stan: "Creator Pro", status: "live", plan: "starter" },
  { feature: "Affiliate tracking", stan: "Creator Pro", status: "live", plan: "starter" },
  { feature: "Upsells and funnels", stan: "Creator Pro", status: "live", plan: "pro" },
  { feature: "Email marketing and automations", stan: "Creator Pro", status: "live", plan: "pro" },
  { feature: "Coaching calls with booking", stan: "Creator", status: "live", plan: "pro" },
  { feature: "Memberships", stan: "Creator", status: "soon", plan: "pro" },
];

export type PlanCard = {
  id: "founding" | "starter" | "pro";
  name: string;
  blurb: string;
  /** What the plan includes. `soon` items are on the roadmap and shown with a Coming soon tag. */
  items: readonly { text: string; soon?: boolean }[];
};

/** Paid plans (PRD F9). Prices come from PLANNED_PRICE_CENTS (final, founder confirmed 2026-11-20). */
export const PLANS: readonly PlanCard[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "Everything you need to open and sell.",
    items: [
      { text: "Mobile storefront at your own link" },
      { text: "Unlimited digital products and lead magnets" },
      { text: `Up to ${PLAN_LIMITS.starter.maxCourses ?? "unlimited"} courses, with quizzes and certificates` },
      { text: "Coupons, order bumps and checkout questions" },
      { text: `Email list and broadcasts (${PLAN_LIMITS.starter.emailSubscribers.toLocaleString("en")} subscribers)` },
      { text: "Pixels, affiliate tracking and CSV exports" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "The full toolkit to grow what you sell.",
    items: [
      { text: "Everything in Starter" },
      { text: `Unlimited courses, ${PLAN_LIMITS.pro.videoHours} hours of video` },
      { text: "Coaching calls with booking" },
      { text: "Upsells, downsells and funnels" },
      { text: "Welcome, abandoned cart and review emails" },
      { text: "Memberships", soon: true },
      { text: "Custom domain", soon: true },
    ],
  },
  {
    id: "founding",
    name: "Founding creator",
    blurb: "For the first 10 creators who join.",
    items: [
      { text: "6 months free, Pro features included" },
      { text: "We set up your store with you" },
      { text: "A direct line to the people building it" },
      { text: "Your feedback shapes what we build next" },
    ],
  },
];

/** Live on Pickstall today. Stated about Pickstall only; no claim about what other platforms lack. */
export const PICKSTALL_EXTRAS = [
  "Discounted prices, shown struck through",
  "Up to 5 custom checkout questions",
  "Purchase email written in your words",
  "Customer list with CSV export",
] as const;
