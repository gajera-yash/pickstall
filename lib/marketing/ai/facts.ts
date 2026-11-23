import { PLANNED_PRICE_CENTS } from "@/lib/config";

// The only facts a DM draft may state (D-121). Our prices come from lib/config.ts. Competitor
// prices were read on 2026-11-23 from third-party reviews (docs/MARKETING_PLAN.md, sources there):
// re-check stan.store and gumroad.com/pricing and update this file if they change.

const dollars = (cents: number) => `$${Math.round(cents / 100)}`;

export const PICKSTALL_FACTS = {
  starter: dollars(PLANNED_PRICE_CENTS.starter),
  pro: dollars(PLANNED_PRICE_CENTS.pro),
  foundingOffer: "free for 6 months, and the founder sets up the store and moves the products over",
  fees: "0% transaction fees from Pickstall; PayPal's normal processing fees still apply",
} as const;

export const COMPETITOR_FACTS = {
  checkedOn: "2026-11-23",
  stanCreatorPro: "$99",
  stanProFeatures: "email broadcasts, upsells and discount codes",
  gumroadFee: "10% + $0.50 per sale",
} as const;
