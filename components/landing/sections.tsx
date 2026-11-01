import { ArrowRight, BarChart3, ChevronDown, CreditCard, Library, Lock, Mail, MessageSquareText, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { ClaimLink } from "@/components/landing/claim-link";
import { CARD_FEES_NOTE, COMING_SOON, FAQ, LANDING_NAV, STEPS } from "@/components/landing/content";
import { FeeCalculator } from "@/components/landing/fee-calculator";
import { PwywTile, ThemeTile } from "@/components/landing/feature-tiles";
import { FoundingCoupon } from "@/components/landing/founding-coupon";
import { StallDemo } from "@/components/landing/stall-demo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/config";
import { cn } from "@/lib/utils";

// Sections of the marketing landing (D-039). Server components; the interactive parts are the
// client components they import.

function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

function SectionHeading({ eyebrow, title, children, center }: { eyebrow: string; title: ReactNode; children?: ReactNode; center?: boolean }) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-3", center && "mx-auto items-center text-center")}>
      <p className="text-sm font-semibold text-blue">{eyebrow}</p>
      <h2 className="text-display-l text-balance">{title}</h2>
      {children && <p className="text-body-l text-mute text-pretty">{children}</p>}
    </div>
  );
}

export function AnnouncementBar() {
  return (
    <div className="border-b-2 border-border-strong bg-yellow text-on-yellow">
      <Container className="flex min-h-10 flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-sm font-semibold">
        <span>
          10 founding creator spots. Free for 6 months.<span className="hidden sm:inline"> 0% transaction fees.</span>
        </span>
        <Link href="/signup" className="inline-flex items-center gap-1 underline underline-offset-4">
          Claim yours
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </Container>
    </div>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="overflow-hidden pt-10 pb-20 sm:pt-16 lg:pb-28">
      <Container className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
        <div className="flex animate-rise flex-col items-start gap-6">
          <Badge variant="live" className="px-3 py-1">
            Open for founding creators
          </Badge>
          <h1 id="hero-title" className="text-display-xl text-balance">
            Open your own stall. <span className="text-blue">0%</span> transaction fees.
          </h1>
          <p className="max-w-xl text-body-l text-mute text-pretty">
            One tap-to-buy page for your digital products, made for the phone your followers already hold. No code. No cut of your sales.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="px-7">
              <Link href="/signup">
                Claim your stall
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="px-7">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
          <p className="text-sm text-mute">Free to join. Founding creators get 6 months free. {CARD_FEES_NOTE}</p>
        </div>
        <StallDemo />
      </Container>
    </section>
  );
}

export function TrustStrip() {
  const items = [
    { icon: CreditCard, text: "Payments processed by Stripe" },
    { icon: Wallet, text: "Money goes straight to your own account" },
    { icon: Lock, text: "Buyers get access only after a verified payment" },
  ];
  return (
    <div className="border-y border-line bg-bg-subtle">
      <Container className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-center sm:gap-10">
        {items.map(({ icon: Icon, text }) => (
          <p key={text} className="flex items-center gap-2 text-sm font-semibold">
            <Icon aria-hidden="true" className="size-5 shrink-0 text-blue" />
            {text}
          </p>
        ))}
      </Container>
    </div>
  );
}

export function ZeroFees() {
  const lines = [
    { label: "Template pack", value: "$49.00" },
    { label: "Platform fee", value: "$0.00", tone: "text-mint" },
    { label: "Card processing", value: "set by Stripe", tone: "text-mute" },
  ];
  return (
    <section id="fees" aria-labelledby="fees-title" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="grid items-start gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-sm font-semibold text-blue">Fees</p>
            <h2 id="fees-title" className="text-display-l text-balance">
              We don&apos;t take a cut of your sales.
            </h2>
            <p className="text-body-l text-mute text-pretty">
              Other platforms keep a percentage of every sale. Pickstall will charge one flat monthly plan, so the more you sell, the more you keep.{" "}
              {CARD_FEES_NOTE}
            </p>
          </div>
          <div aria-label="Example receipt" role="group" className="w-full max-w-sm -rotate-1">
            <div className="flex flex-col gap-2 rounded-sm border-2 border-border-strong bg-surface px-5 pt-5 pb-4 font-mono text-sm shadow-hard-sm">
              <p className="flex justify-between font-semibold">
                <span>Receipt</span>
                <Badge variant="example">Example</Badge>
              </p>
              {lines.map((line) => (
                <p key={line.label} className={cn("flex justify-between gap-4", line.tone)}>
                  <span>{line.label}</span>
                  <span className="tabular-nums">{line.value}</span>
                </p>
              ))}
              <p className="flex justify-between gap-4 border-t border-dashed border-input pt-2 font-semibold">
                <span>Paid to your account</span>
                <span className="tabular-nums">$49.00*</span>
              </p>
              <p className="text-xs text-mute">*before Stripe&apos;s card processing fee</p>
            </div>
          </div>
        </div>
        <FeeCalculator />
      </Container>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 bg-bg-subtle py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading eyebrow="How it works" title={<span id="how-title">Live in minutes. No code.</span>}>
          From the link in your bio to money in your account, in four steps.
        </SectionHeading>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-3 rounded-lg border-2 border-border-strong bg-surface p-5 shadow-hard-sm">
              <span className="flex size-10 items-center justify-center rounded-full bg-blue font-display text-base font-extrabold text-on-blue">{index + 1}</span>
              <h3 className="text-h3">{step.title}</h3>
              <p className="text-sm text-mute">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function Tile({ title, body, children, className }: { title: string; body: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-5 rounded-lg border border-line bg-surface p-5 sm:p-6", className)}>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-h3">{title}</h3>
        <p className="text-sm text-mute">{body}</p>
      </div>
      {children}
    </div>
  );
}

export function Features() {
  const bars = [32, 48, 40, 64, 56, 80, 72];
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading eyebrow="Features" title={<span id="features-title">Everything you sell with, on one shelf.</span>}>
          Your store, your checkout, your emails and your numbers. Customizable where it matters, safe by default.
        </SectionHeading>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Tile title="A store that looks like you" body="Three themes, your accent color, your photo and links. Try a theme:">
            <ThemeTile />
          </Tile>

          <Tile title="Pay what you want" body="Fixed price or let fans pay more. You set the minimum.">
            <PwywTile />
          </Tile>

          <Tile title="Your checkout, your questions" body="Ask up to five questions at checkout. Answers land in your Customers tab.">
            <div aria-hidden="true" className="flex flex-col gap-2 rounded-md border border-line bg-bg-subtle p-3 text-sm">
              <span className="rounded-md border border-input bg-surface px-3 py-2 text-mute">Your name</span>
              <span className="rounded-md border border-input bg-surface px-3 py-2 text-mute">Email</span>
              <span className="flex items-center gap-2 rounded-md border border-blue bg-surface px-3 py-2">
                <MessageSquareText className="size-4 text-blue" />
                What&apos;s your Instagram handle?
              </span>
            </div>
          </Tile>

          <Tile title="Purchase emails in your words" body="Write the confirmation email yourself. The secure access link is always included.">
            <div aria-hidden="true" className="flex flex-col gap-1.5 rounded-md border border-line bg-bg-subtle p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <Mail className="size-4 text-blue" />
                Your guide is here, Jordan
              </p>
              <p className="text-mute">Thanks for buying Budget workbook. Open it any time from your library.</p>
              <span className="mt-1 self-start rounded-md bg-blue px-3 py-1.5 text-xs font-semibold text-on-blue">Open your purchase</span>
            </div>
          </Tile>

          <Tile title="Customers and income" body="Every order, buyer and answer in one place. Export to CSV whenever you like.">
            <div aria-hidden="true" className="flex flex-col gap-3 rounded-md border border-line bg-bg-subtle p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 className="size-4 text-blue" />
                  Last 7 days
                </span>
                <Badge variant="example">Example</Badge>
              </div>
              <div className="flex h-20 items-end gap-1.5">
                {bars.map((height, index) => (
                  <span key={index} className="flex-1 rounded-t-sm bg-blue" style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          </Tile>

          <Tile title="A library for your buyers" body="Buyers sign in with a code or password and find everything they bought in one place.">
            <div aria-hidden="true" className="flex items-center gap-3 rounded-md border border-line bg-bg-subtle p-3 text-sm">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-soft">
                <Library className="size-5 text-blue" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">Moody film presets</span>
                <span className="block text-xs text-mute">From Ava Lens Presets</span>
              </span>
              <span className="text-xs font-semibold text-blue">Open</span>
            </div>
          </Tile>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-input p-5 sm:flex-row sm:items-center">
          <p className="shrink-0 text-sm font-semibold">On the way:</p>
          <ul className="flex flex-wrap gap-2">
            {COMING_SOON.map((item) => (
              <li key={item} className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1 pl-3 text-sm">
                {item}
                <Badge variant="soon">Coming soon</Badge>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

export function FoundingOffer() {
  const perks = [
    "Free for the first 6 months",
    "We set up your store with you",
    "A direct line to the people building it",
    "Your feedback shapes what we build next",
  ];
  return (
    <section aria-labelledby="founding-title" className="bg-blue-soft py-20 sm:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <SectionHeading eyebrow="Founding creators" title={<span id="founding-title">Free for 6 months. Only 10 spots.</span>}>
            After the free period: one flat monthly plan, 0% transaction fees. You will see the price before anyone is asked to pay.
          </SectionHeading>
          <ul className="flex flex-col gap-2.5">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-3 font-medium">
                <span aria-hidden="true" className="size-2.5 shrink-0 rotate-45 bg-blue" />
                {perk}
              </li>
            ))}
          </ul>
        </div>
        <FoundingCoupon />
      </Container>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="flex flex-col gap-10">
        <SectionHeading eyebrow="FAQ" title={<span id="faq-title">Questions, answered plainly.</span>} center />
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-lg border border-line bg-surface open:border-input">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-5 py-4 font-display text-h4 [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-mute transition-transform duration-(--dur-base) group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 text-mute">{item.a}</p>
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
        <div className="flex flex-col items-center gap-8 rounded-lg border-2 border-border-strong bg-surface px-5 py-12 text-center shadow-hard-md sm:px-10 sm:py-16 lg:shadow-hard-lg">
          <div className="flex flex-col items-center gap-3">
            <h2 id="claim-title" className="text-display-xl text-balance">
              Your stall is waiting.
            </h2>
            <p className="max-w-lg text-body-l text-mute">Check if your name is free, then create your account in a minute.</p>
          </div>
          <div className="w-full max-w-md">
            <ClaimLink />
          </div>
          <p className="text-sm text-mute">
            Already have a stall?{" "}
            <Link href="/login" className="font-semibold text-blue underline underline-offset-4 hover:text-blue-hover">
              Log in
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}

export function LandingFooter() {
  const links = [
    ...LANDING_NAV,
    { href: "/login", label: "Log in" },
    { href: "/signup", label: "Sign up" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
  ];
  return (
    <footer className="border-t border-line bg-bg-subtle">
      <Container className="flex flex-col gap-8 py-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-sm flex-col gap-3">
            <Wordmark className="h-9" />
            <p className="text-sm text-mute">A store for creators who sell digital products. 0% transaction fees, no code.</p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm font-semibold text-blue underline underline-offset-4">
              {SUPPORT_EMAIL}
            </a>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="py-1 text-sm font-semibold text-ink hover:text-blue">
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-1 border-t border-line pt-6 text-xs text-mute sm:flex-row sm:justify-between">
          <p>© {APP_NAME}</p>
          <p>{CARD_FEES_NOTE.replace("still ", "")} Creators are the seller of record for their sales.</p>
        </div>
      </Container>
    </footer>
  );
}
