// Copy for the marketing landing (D-039). Honesty rules: Phase 1 sells digital products; anything
// else is tagged "Coming soon"; every 0% claim sits near the card-processing note (DESIGN.md 15).

import { PLANNED_PRICE_CENTS, TRIAL_DAYS } from "@/lib/config";
import { formatWholeDollars } from "@/lib/landing/demo";

export const LANDING_NAV = [
  { href: "#features", label: "Features" },
  { href: "#product", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "#compare", label: "Vs Stan Store" },
  { href: "#faq", label: "FAQ" },
] as const;

export const CARD_FEES_NOTE = "Stripe's card processing fees still apply.";

export const STEPS = [
  { title: "Claim your link", body: "Pick a username. Your stall lives at one short link you can put in any bio." },
  { title: "Make it yours", body: "Photo, bio, social links, a theme and your own accent color. No code, no designer." },
  { title: "Add what you sell", body: "Guides, templates, presets, workbooks. Set a price, and add a discount when you like." },
  { title: "Connect payments and share", body: "Buyers pay into your own Stripe account. You see every order, customer and dollar." },
] as const;

/** Not built yet. Courses, coupons, order bumps, emails, bookings and affiliates are live. */
export const COMING_SOON = ["Custom domain", "Memberships", "Payment plans", "Team accounts", "Store templates", "Public API"] as const;

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
    q: "What does 0% transaction fees mean?",
    a: "We never take a percentage of your sales. Buyers pay into your own Stripe account. Stripe's card processing fees still apply, as they do everywhere.",
  },
  {
    q: "What does it cost?",
    a: `Every new store starts with a ${TRIAL_DAYS}-day free trial, no card needed. Founding creators (the first 10) get 6 months free. After that, plans are planned at ${STARTER} a month (Starter) and ${PRO} a month (Pro), with 0% transaction fees. If you don't pick a plan when the free period ends, your store pauses (nothing is deleted) until you do. Final prices are confirmed before anyone is asked to pay.`,
  },
  {
    q: "How is Pickstall different from Stan Store?",
    a: `Same kind of creator store, at a lower price. ${STAN.name}'s plans are ${price(STAN.creatorCents)} and ${price(STAN.creatorProCents)} a month; ours are planned at ${STARTER} and ${PRO}, and founding creators pay nothing for 6 months. Storefront, digital products and sales analytics are live today; courses, discount codes, order bumps, email marketing and the rest of the Pro toolkit are on the way and marked Coming soon.`,
  },
  {
    q: "Do I need to code or design?",
    a: "No. You fill in your details, pick a theme and add products. Your stall works on every phone out of the box.",
  },
  {
    q: "How do I get paid?",
    a: "You connect your own Stripe account. Money goes straight to it; Pickstall never holds or forwards your funds.",
  },
  {
    q: "Who handles taxes?",
    a: "You do, as the seller. Pickstall is not a merchant of record and does not collect or file sales tax or VAT for you.",
  },
  {
    q: "What can I sell today?",
    a: "Digital products: guides, templates, presets, workbooks and more, at a price you set, with an optional discount. Courses, coupons and order bumps are coming soon.",
  },
  {
    q: "How do my buyers get their purchase?",
    a: "After a verified payment they get an email with a private link and a library where they can open their purchases any time.",
  },
  {
    q: "Which countries?",
    a: "We start with creators selling to buyers in the US, UK and Canada. Creators elsewhere can join where Stripe supports them.",
  },
] as const;

export type CompareRow = {
  feature: string;
  /** Which Stan Store plan includes it. */
  stan: "Creator" | "Creator Pro";
  /** Live today on Pickstall, or on the roadmap. */
  status: "live" | "soon";
  /** The planned Pickstall plan that includes it (PRD F9). */
  plan: "starter" | "pro";
};

export const COMPARE_ROWS: readonly CompareRow[] = [
  { feature: "Mobile storefront at your own link", stan: "Creator", status: "live", plan: "starter" },
  { feature: "Sell digital products", stan: "Creator", status: "live", plan: "starter" },
  { feature: "Sales and customer analytics", stan: "Creator", status: "live", plan: "starter" },
  { feature: "Online courses", stan: "Creator", status: "soon", plan: "starter" },
  { feature: "Lead magnets and email collection", stan: "Creator", status: "soon", plan: "starter" },
  { feature: "Discount codes", stan: "Creator Pro", status: "soon", plan: "starter" },
  { feature: "Order bumps", stan: "Creator Pro", status: "soon", plan: "starter" },
  { feature: "Ad pixel tracking", stan: "Creator Pro", status: "soon", plan: "starter" },
  { feature: "Upsells and funnels", stan: "Creator Pro", status: "soon", plan: "pro" },
  { feature: "Email marketing and automations", stan: "Creator Pro", status: "soon", plan: "pro" },
  { feature: "Affiliate tracking", stan: "Creator Pro", status: "soon", plan: "pro" },
  { feature: "Bookings and memberships", stan: "Creator", status: "soon", plan: "pro" },
];

export type PlanCard = {
  id: "founding" | "starter" | "pro";
  name: string;
  blurb: string;
  /** What the plan includes. `soon` items are on the roadmap and shown with a Coming soon tag. */
  items: readonly { text: string; soon?: boolean }[];
};

/** Planned plans (PRD F9). Prices come from PLANNED_PRICE_CENTS; nothing here is billed yet. */
export const PLANS: readonly PlanCard[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "Everything you need to open and sell.",
    items: [
      { text: "Mobile storefront at your own link" },
      { text: "Unlimited digital products" },
      { text: "Discounts and custom checkout questions" },
      { text: "Sales and customer analytics, CSV export" },
      { text: "Courses, discount codes and order bumps", soon: true },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "The full toolkit to grow what you sell.",
    items: [
      { text: "Everything in Starter" },
      { text: "Email marketing and automations", soon: true },
      { text: "Upsells and funnels", soon: true },
      { text: "Memberships, bookings and affiliates", soon: true },
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
