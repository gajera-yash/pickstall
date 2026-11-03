import { HelpCircle, MessageCircleHeart, Plus, Quote } from "lucide-react";
import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { ClaimLink } from "@/components/landing/claim-link";
import { CARD_FEES_NOTE, FAQ, LANDING_NAV, STAN } from "@/components/landing/content";
import { FoundingCoupon } from "@/components/landing/founding-coupon";
import { Container, SectionHeading } from "@/components/landing/ui";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/config";

// The closing sections of the marketing landing (D-039): founding creators (in place of
// testimonials, which we will only show once they are real), FAQ, the final CTA and the footer.

export function Founders() {
  return (
    <section id="founders" aria-labelledby="founders-title" className="scroll-mt-20 bg-blue-soft py-20 sm:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-8">
          <SectionHeading id="founders-title" eyebrow="Founding creators" icon={MessageCircleHeart} title="Be one of the first ten." muted="Your story goes here.">
            We are opening {APP_NAME} to 10 founding creators first. You get it free for 6 months and help shape what we build.
          </SectionHeading>
          <figure className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
            <Quote aria-hidden="true" className="size-6 text-blue" />
            <blockquote className="text-body-l text-pretty">
              We are building {APP_NAME} for creators who are tired of paying a share of every sale. Founding creators get a direct line to us, and we set up
              your store with you.
            </blockquote>
            <figcaption className="text-sm text-mute">The team building {APP_NAME}</figcaption>
          </figure>
          <p className="text-sm text-mute">
            We don&apos;t publish made-up reviews. Quotes from founding creators will appear here once they have sold with {APP_NAME}.
          </p>
        </div>
        <FoundingCoupon />
      </Container>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
          <SectionHeading id="faq-title" eyebrow="FAQ" icon={HelpCircle} title="Questions," muted="answered plainly." />
          <p className="text-mute">
            Something else?{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-blue underline underline-offset-4 hover:text-blue-hover">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
        <div className="flex flex-col border-t border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group border-b border-line">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-h4 transition-colors duration-(--dur-fast) hover:text-blue [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus aria-hidden="true" className="size-5 shrink-0 text-mute transition-transform duration-(--dur-base) ease-(--ease-out) group-open:rotate-45" />
              </summary>
              <p className="animate-rise pr-8 pb-6 text-mute text-pretty">{item.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="claim-title" className="pb-20 sm:pb-28">
      <Container>
        <div className="relative overflow-hidden rounded-lg border-2 border-border-strong bg-surface px-5 py-14 shadow-hard-md sm:px-10 sm:py-20 lg:shadow-hard-lg">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-dots mask-fade-y" />
          <div className="relative flex flex-col items-center gap-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <h2 id="claim-title" className="text-display-xl text-balance">
                Your stall is waiting.
              </h2>
              <p className="max-w-lg text-body-l text-mute">Check if your name is free, then create your account in a minute.</p>
            </div>
            <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5 sm:p-6">
              <ClaimLink />
            </div>
            <p className="text-sm text-mute">
              Already have a stall?{" "}
              <Link href="/login" className="font-semibold text-blue underline underline-offset-4 hover:text-blue-hover">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function LandingFooter() {
  const groups = [
    { title: "Product", links: [...LANDING_NAV] },
    {
      title: "Account",
      links: [
        { href: "/signup", label: "Sign up" },
        { href: "/login", label: "Log in" },
        { href: "/library", label: "Buyer library" },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/privacy", label: "Privacy" },
        { href: "/terms", label: "Terms" },
      ],
    },
  ];
  return (
    <footer className="border-t border-line bg-bg-subtle">
      <Container className="flex flex-col gap-10 py-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div className="flex max-w-sm flex-col gap-3">
            <Wordmark className="h-9" />
            <p className="text-sm text-mute">A store for creators who sell digital products. 0% transaction fees, no code.</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="self-start text-sm font-semibold text-blue underline underline-offset-4">
              {SUPPORT_EMAIL}
            </a>
          </div>
          {groups.map((group) => (
            <nav key={group.title} aria-label={`Footer: ${group.title}`} className="flex flex-col gap-2">
              <p className="text-sm font-semibold">{group.title}</p>
              {group.links.map((link) => (
                <a key={link.href} href={link.href} className="py-1 text-sm text-mute hover:text-ink">
                  {link.label}
                </a>
              ))}
            </nav>
          ))}
        </div>
        <div className="flex flex-col gap-1 border-t border-line pt-6 text-xs text-mute sm:flex-row sm:justify-between sm:gap-6">
          <p className="shrink-0">© {APP_NAME}</p>
          <p>
            {CARD_FEES_NOTE.replace("still ", "")} Creators are the seller of record for their sales. {STAN.name} is a trademark of its owner; {APP_NAME} is
            not affiliated with it.
          </p>
        </div>
      </Container>
    </footer>
  );
}
