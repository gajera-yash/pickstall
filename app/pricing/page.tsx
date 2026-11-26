import type { Metadata } from "next";

import { FAQ } from "@/components/landing/content";
import { Pricing } from "@/components/landing/pricing";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { APP_NAME, FOUNDING_MONTHS, FOUNDING_SPOTS, TRIAL_DAYS } from "@/lib/config";
import { faqSchema, softwareApplicationSchema } from "@/lib/seo/schema";
import { PRICES, SITE_URL } from "@/lib/seo/site-facts";

// Pricing (D-134): the plans with their prices, the free period and the 0% fee, in plain words.

export const metadata: Metadata = {
  title: `${APP_NAME} pricing: $${PRICES.starter} and $${PRICES.pro} a month, 0% transaction fees`,
  description: `${APP_NAME} plans: Starter $${PRICES.starter}/month and Pro $${PRICES.pro}/month, ${TRIAL_DAYS}-day free trial, 0% transaction fees. PayPal's processing fees still apply.`,
  alternates: { canonical: `${SITE_URL}/pricing` },
};

const PRICING_FAQ = FAQ.filter((item) => /cost|0% transaction|paid|taxes/i.test(item.q));

export default function PricingPage() {
  return (
    <MarketingPage
      title={`${APP_NAME} pricing`}
      lead={
        <p>
          Two plans: Starter at ${PRICES.starter} a month and Pro at ${PRICES.pro} a month. Every new store starts with a {TRIAL_DAYS}-day free trial with Pro
          features, no card needed, and the first {FOUNDING_SPOTS} founding creators get {FOUNDING_MONTHS} months free. {APP_NAME} takes 0% of your sales;
          PayPal&apos;s processing fees still apply.
        </p>
      }
      crumbs={[{ name: "Pricing", path: "/pricing" }]}
      schema={[softwareApplicationSchema(), faqSchema(PRICING_FAQ)]}
    >
      <Pricing />
    </MarketingPage>
  );
}
