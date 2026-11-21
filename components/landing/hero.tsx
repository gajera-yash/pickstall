import { ArrowRight, BadgeCheck, CreditCard, Lock, Wallet } from "lucide-react";
import Link from "next/link";

import { CARD_FEES_NOTE, STAN } from "@/components/landing/content";
import { StallDemo } from "@/components/landing/stall-demo";
import { Container } from "@/components/landing/ui";
import { Button } from "@/components/ui/button";
import { PLANNED_PRICE_CENTS, TRIAL_DAYS } from "@/lib/config";
import { formatWholeDollars, yearlySavingsCents } from "@/lib/landing/demo";
import { cn } from "@/lib/utils";

// Announcement bar, hero and the proof strip (D-039). The hero entrance is CSS (animate-rise with
// staggered delays), so it plays without waiting for JavaScript and is off under reduced motion.

export function AnnouncementBar() {
  return (
    <div className="border-b-2 border-border-strong bg-yellow text-on-yellow">
      <Container className="flex min-h-10 flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-sm font-semibold">
        <span>
          {STAN.name} Pro is {formatWholeDollars(STAN.creatorProCents)}/mo. Ours is {formatWholeDollars(PLANNED_PRICE_CENTS.pro)}.
          <span className="hidden sm:inline"> Founding creators: 6 months free.</span>
        </span>
        <a href="#compare" className="inline-flex items-center gap-1 underline underline-offset-4">
          Compare
          <ArrowRight aria-hidden="true" className="size-4" />
        </a>
      </Container>
    </div>
  );
}

export function Hero() {
  const proSavings = formatWholeDollars(yearlySavingsCents(STAN.creatorProCents, PLANNED_PRICE_CENTS.pro));
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden pt-14 pb-20 sm:pt-20 lg:pb-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-dots mask-fade-b" />
      <Container className="relative flex flex-col items-center gap-14 sm:gap-16">
        <div className="flex max-w-3xl flex-col items-center gap-6 text-center">
          <a
            href="#pricing"
            className="group inline-flex animate-rise items-center gap-2 rounded-full border border-line bg-surface py-1 pr-3 pl-1 text-sm font-semibold transition-colors duration-(--dur-fast) hover:border-input"
          >
            <span className="rounded-full bg-yellow px-2.5 py-0.5 text-xs whitespace-nowrap text-on-yellow">10 spots</span>
            <span className="sm:hidden">6 months free for founders</span>
            <span className="hidden sm:inline">Founding creators get 6 months free</span>
            <ArrowRight aria-hidden="true" className="size-4 text-mute transition-transform duration-(--dur-fast) group-hover:translate-x-0.5" />
          </a>
          <h1 id="hero-title" className="animate-rise text-display-xl text-balance [animation-delay:60ms]">
            Open your own stall.{" "}
            <span className="sm:whitespace-nowrap">
              <span className="text-blue">0%</span> transaction fees.
            </span>
          </h1>
          <p className="max-w-xl animate-rise text-body-l text-mute text-pretty [animation-delay:120ms] sm:text-lg">
            One tap-to-buy page for your digital products, courses and coaching calls, made for the phone your followers already hold. No code. No cut of your sales.
          </p>
          <div className="flex w-full animate-rise flex-col gap-3 [animation-delay:180ms] sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="px-7">
              <Link href="/signup">
                Claim your stall
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="px-7">
              <a href="#demo">Try the demo</a>
            </Button>
          </div>
          <p className="animate-rise text-sm text-mute [animation-delay:240ms]">
            {TRIAL_DAYS}-day free trial, no card needed. {CARD_FEES_NOTE}{" "}
            <a href="#compare" className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
              Coming from {STAN.name}? Save {proSavings} a year.
            </a>
          </p>
        </div>

        <div id="demo" className="w-full max-w-5xl animate-rise scroll-mt-24 [animation-delay:300ms]">
          <StallDemo />
        </div>
      </Container>
    </section>
  );
}

const PROOF = [
  { icon: BadgeCheck, value: "0%", label: "Platform fee. Stripe card fees still apply." },
  { icon: CreditCard, value: "Stripe", label: "Processes every payment" },
  { icon: Wallet, value: "Direct", label: "Money goes to your own account" },
  { icon: Lock, value: "Verified", label: "Access only after a confirmed payment" },
] as const;

/** Proof that is true today: how money and access work. No logos, counts or quotes we don't have. */
export function ProofStrip() {
  return (
    <section aria-label="How Pickstall handles your money" className="border-y border-line">
      <Container className="grid grid-cols-2 lg:grid-cols-4">
        {PROOF.map(({ icon: Icon, value, label }, index) => (
          <div
            key={label}
            className={cn(
              "flex flex-col gap-2 border-line py-7 pr-4 sm:pr-6",
              index % 2 === 1 && "border-l pl-4 sm:pl-6",
              index >= 2 && "border-t lg:border-t-0",
              index === 2 && "lg:border-l lg:pl-6",
            )}
          >
            <Icon aria-hidden="true" className="size-5 text-blue" />
            <p className="font-display text-money-l tabular-nums">{value}</p>
            <p className="text-sm text-mute">{label}</p>
          </div>
        ))}
      </Container>
    </section>
  );
}
