import type { Metadata } from "next";

import { Container } from "@/components/landing/ui";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { APP_NAME } from "@/lib/config";
import { organizationSchema } from "@/lib/seo/schema";
import { CONTACT_EMAIL, KEY_FACTS, ONE_LINER, SITE_URL } from "@/lib/seo/site-facts";

// About (D-134): what Pickstall is, who it is for, how it makes money and the key facts.

export const metadata: Metadata = {
  title: `About ${APP_NAME}`,
  description: `${ONE_LINER} Who it is for, how it works and how ${APP_NAME} makes money.`,
  alternates: { canonical: `${SITE_URL}/about` },
};

export default function AboutPage() {
  return (
    <MarketingPage title={`About ${APP_NAME}`} lead={<p>{ONE_LINER}</p>} crumbs={[{ name: "About", path: "/about" }]} schema={[organizationSchema()]}>
      <Container className="flex max-w-3xl flex-col gap-8 pb-12">
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-h2">Who it is for</h2>
          <p className="text-body-l text-mute">
            Creators who sell to the audience they already have on Instagram, TikTok and YouTube: coaches, fitness trainers, teachers, artists, writers
            and anyone with a guide, a course or their time to sell. One link in their bio opens a store made for phones.
          </p>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-h2">How {APP_NAME} makes money</h2>
          <p className="text-body-l text-mute">
            Creators pay a monthly plan. {APP_NAME} takes 0% of their sales: buyers pay into the creator&apos;s own PayPal account, and {APP_NAME} never
            holds or forwards their money. The creator is the seller of record.
          </p>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-h2">Key facts</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-body-l text-mute">
            {KEY_FACTS.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-h2">Contact</h2>
          <p className="text-body-l text-mute">
            Write to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-blue underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
            . A real person answers, usually within a day.
          </p>
        </section>
      </Container>
    </MarketingPage>
  );
}
