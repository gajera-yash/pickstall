import type { Metadata } from "next";

import { Features } from "@/components/landing/features";
import { AnalyticsSection, CheckoutSection, ProductsSection, StorefrontSection } from "@/components/landing/product";
import { Container } from "@/components/landing/ui";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { PLAN_FEATURE_GROUPS } from "@/lib/plans/catalog";
import { APP_NAME } from "@/lib/config";
import { softwareApplicationSchema } from "@/lib/seo/schema";
import { ONE_LINER, SITE_URL } from "@/lib/seo/site-facts";

// Features (D-134): everything Pickstall does today, as a scannable list and the product sections.

export const metadata: Metadata = {
  title: `${APP_NAME} features: store, courses, coaching, email and more`,
  description: `${ONE_LINER} See every feature: storefront and templates, digital products, courses, coaching calls, coupons, upsells, email marketing and analytics.`,
  alternates: { canonical: `${SITE_URL}/features` },
};

export default function FeaturesPage() {
  return (
    <MarketingPage title={`${APP_NAME} features`} lead={<p>{ONE_LINER} Here is everything it does today.</p>} crumbs={[{ name: "Features", path: "/features" }]} schema={[softwareApplicationSchema()]}>
      <Container className="grid gap-6 pb-12 md:grid-cols-3">
        {PLAN_FEATURE_GROUPS.map((group) => (
          <section key={group.title} aria-labelledby={`group-${group.title}`} className="flex flex-col gap-3 rounded-lg border border-line p-6">
            <h2 id={`group-${group.title}`} className="font-display text-h3">
              {group.title}
            </h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
              {group.rows.map((row) => (
                <li key={row.label}>{row.label}</li>
              ))}
            </ul>
          </section>
        ))}
      </Container>
      <Features />
      <StorefrontSection />
      <ProductsSection />
      <CheckoutSection />
      <AnalyticsSection />
    </MarketingPage>
  );
}
