import type { Metadata } from "next";

import { FAQ } from "@/components/landing/content";
import { Faq } from "@/components/landing/sections";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { APP_NAME } from "@/lib/config";
import { faqSchema } from "@/lib/seo/schema";
import { ONE_LINER, SITE_URL } from "@/lib/seo/site-facts";

// FAQ (D-134): plain questions and short answers, also as FAQPage structured data.

export const metadata: Metadata = {
  title: `${APP_NAME} FAQ: fees, pricing, payments and what you can sell`,
  description: `Answers about ${APP_NAME}: what it is, what it costs, 0% transaction fees, how you get paid, taxes and what you can sell.`,
  alternates: { canonical: `${SITE_URL}/faq` },
};

export default function FaqPage() {
  return (
    <MarketingPage title={`${APP_NAME} FAQ`} lead={<p>{ONE_LINER} Below are the questions creators ask most, answered plainly.</p>} crumbs={[{ name: "FAQ", path: "/faq" }]} schema={[faqSchema(FAQ)]}>
      <Faq />
    </MarketingPage>
  );
}
