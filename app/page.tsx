import type { Metadata } from "next";
import { Suspense } from "react";

import { CompareStan } from "@/components/landing/compare-stan";
import { Features } from "@/components/landing/features";
import { AnnouncementBar, Hero, ProofStrip } from "@/components/landing/hero";
import { LandingNav } from "@/components/landing/landing-nav";
import { MotionProvider } from "@/components/landing/motion";
import { GuestActions, NavActions } from "@/components/landing/nav-actions";
import { Pricing } from "@/components/landing/pricing";
import { AnalyticsSection, CheckoutSection, ProductsSection, StorefrontSection } from "@/components/landing/product";
import { Faq, FinalCta, Founders, LandingFooter } from "@/components/landing/sections";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `${APP_NAME}: your own stall, 0% transaction fees`,
  description:
    "A lower-cost Stan Store alternative: sell digital products, courses and coaching calls from one tap-to-buy page made for phones. No code, no cut of your sales. Stripe's card processing fees still apply.",
  openGraph: {
    title: `${APP_NAME}: open your own stall`,
    description: "Sell digital products, courses and coaching from one tap-to-buy page. 0% transaction fees.",
    type: "website",
  },
};

// Marketing landing (D-039, redesign D-043). Static except the nav's session check, which streams in.
export default function Home() {
  return (
    <>
      <a href="#main" className="sr-only z-50 rounded-md bg-surface px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <AnnouncementBar />
      <LandingNav
        actions={
          <Suspense fallback={<GuestActions />}>
            <NavActions />
          </Suspense>
        }
      />
      <main id="main" className="flex-1">
        <MotionProvider>
          <Hero />
          <ProofStrip />
          <Features />
          <StorefrontSection />
          <ProductsSection />
          <CheckoutSection />
          <AnalyticsSection />
          <Pricing />
          <CompareStan />
          <Founders />
          <Faq />
          <FinalCta />
        </MotionProvider>
      </main>
      <LandingFooter />
    </>
  );
}
