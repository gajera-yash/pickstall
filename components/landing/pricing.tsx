import { ArrowRight, Check, Clock, Tag } from "lucide-react";
import Link from "next/link";

import { CARD_FEES_NOTE, PLANS, type PlanCard } from "@/components/landing/content";
import { FeeCalculator } from "@/components/landing/fee-calculator";
import { Container, SectionHeading } from "@/components/landing/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLANNED_PRICE_CENTS } from "@/lib/config";
import { formatWholeDollars } from "@/lib/landing/demo";

// Pricing (D-039, PRD F9): planned plans, nothing billed yet. The founding plan is the featured
// card; the fee calculator below shows what "no cut" means in dollars.

function PlanItems({ items }: { items: PlanCard["items"] }) {
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {items.map((item) => (
        <li key={item.text} className="flex items-start gap-2.5">
          {item.soon ? (
            <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mute" />
          ) : (
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mint" />
          )}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {item.text}
            {item.soon && <Badge variant="soon">Coming soon</Badge>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PaidPlan({ plan }: { plan: PlanCard & { id: "starter" | "pro" } }) {
  return (
    <div className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 sm:p-7">
      <div className="flex flex-col gap-2">
        <h3 className="text-h3">{plan.name}</h3>
        <p className="text-sm text-mute">{plan.blurb}</p>
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="font-display text-display-l tabular-nums">{formatWholeDollars(PLANNED_PRICE_CENTS[plan.id])}</span>
        <span className="text-sm text-mute">per month, planned</span>
      </p>
      <Button asChild variant="secondary" className="w-full">
        <Link href="/signup">Join free</Link>
      </Button>
      <PlanItems items={plan.items} />
    </div>
  );
}

function FoundingPlan({ plan }: { plan: PlanCard }) {
  return (
    <div className="relative order-first flex flex-col gap-6 rounded-lg border-2 border-border-strong bg-surface p-6 shadow-hard-md sm:p-7 lg:order-none lg:-my-4 lg:py-10 lg:shadow-hard-lg">
      <span className="absolute -top-3.5 left-6 inline-flex items-center gap-1.5 rounded-full border-2 border-border-strong bg-yellow px-3 py-0.5 text-xs font-semibold text-on-yellow">
        <Tag aria-hidden="true" className="size-3.5" />
        10 spots
      </span>
      <div className="flex flex-col gap-2">
        <h3 className="text-h3">{plan.name}</h3>
        <p className="text-sm text-mute">{plan.blurb}</p>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-display text-display-l tabular-nums">$0</span>
        <span className="text-sm text-mute">for 6 months, then a flat plan</span>
      </p>
      <Button asChild className="w-full">
        <Link href="/signup">
          Claim a founding spot
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
      <PlanItems items={plan.items} />
    </div>
  );
}

export function Pricing() {
  const byId = (id: PlanCard["id"]) => PLANS.find((plan) => plan.id === id);
  const starter = byId("starter");
  const pro = byId("pro");
  const founding = byId("founding");

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="flex flex-col gap-14">
        <SectionHeading id="pricing-title" eyebrow="Pricing" icon={Tag} title="One flat plan." muted="0% of your sales." center>
          You pay a monthly plan, never a share of what you sell. Prices are planned and confirmed before anyone is asked to pay. {CARD_FEES_NOTE}
        </SectionHeading>

        <div className="grid items-start gap-8 lg:grid-cols-3 lg:items-center lg:gap-6">
          {starter && <PaidPlan plan={{ ...starter, id: "starter" }} />}
          {founding && <FoundingPlan plan={founding} />}
          {pro && <PaidPlan plan={{ ...pro, id: "pro" }} />}
        </div>

        <div id="fees" className="grid scroll-mt-24 items-center gap-10 rounded-lg border border-line bg-bg-subtle p-5 sm:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:p-12">
          <div className="flex flex-col gap-4">
            <h3 className="text-display text-balance">The more you sell, the more you keep.</h3>
            <p className="text-body-l text-mute text-pretty">
              Platforms that take a percentage grow their cut as you grow. Slide to your monthly sales and see what a per-sale fee would cost you over a
              year.
            </p>
            <p className="text-sm text-mute">{CARD_FEES_NOTE}</p>
          </div>
          <FeeCalculator />
        </div>
      </Container>
    </section>
  );
}
