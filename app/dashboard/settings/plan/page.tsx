import { Check } from "lucide-react";
import { Suspense } from "react";

import { formatPlanDate } from "@/components/dashboard/trial-banner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { PAID_PLANS, PLANNED_PRICE_CENTS, SUPPORT_EMAIL, TRIAL_DAYS, type PaidPlan } from "@/lib/config";
import { formatWholeDollars } from "@/lib/landing/demo";
import { billingConfigured } from "@/lib/payments/billing";
import { liveKey } from "@/lib/payments/test-account";
import type { StoreAccess } from "@/lib/plans/access";
import { openBillingPortal, startSubscription } from "@/lib/plans/actions";
import { billingOfOwner } from "@/lib/plans/billing-queries";

// Settings > Plan (D-072, D-073): the free period or paid plan, subscribe, switch and manage billing.
// Every button is a plain form that ends in a redirect, so the page works without client code.

export default function PlanSettingsPage({ searchParams }: PageProps<"/dashboard/settings/plan">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <PlanContent searchParams={searchParams} />
    </Suspense>
  );
}

const PLAN_LABELS: Record<PaidPlan, { name: string; blurb: string }> = {
  starter: { name: "Starter", blurb: "Everything you need to open and sell." },
  pro: { name: "Pro", blurb: "The full toolkit to grow, as it ships." },
};

/** Messages after a button or the trip to Stripe. Only these keys are shown; anything else is ignored. */
const OUTCOMES: Record<string, { variant: "info" | "success" | "warning" | "error"; text: string }> = {
  success: { variant: "success", text: "Thank you! Your plan is active and your store is open." },
  pending: { variant: "info", text: "Payment received. Your plan turns on as soon as Stripe confirms it, usually within a minute. Refresh this page." },
  cancelled: { variant: "info", text: "No changes made. You can choose a plan any time." },
  switched: { variant: "success", text: "Plan changed. The difference is added to (or taken off) your next invoice." },
  same_plan: { variant: "info", text: "You are already on that plan." },
  slow: { variant: "warning", text: "Slow down a little, then try again." },
  no_customer: { variant: "info", text: "Choose a plan first; billing settings appear after your first payment." },
  unavailable: { variant: "warning", text: "Paid plans aren't set up on this server yet." },
  error: { variant: "error", text: "Something went wrong with Stripe. Nothing was charged twice. Please try again." },
};

function statusOf(access: StoreAccess): { badge: { label: string; variant: "live" | "testMode" | "draft" }; text: string } {
  const end = access.endsAt ? formatPlanDate(access.endsAt) : null;
  const planName = access.plan ? PLAN_LABELS[access.plan].name : "";
  switch (access.state) {
    case "active":
      return access.cancelsAtPeriodEnd
        ? { badge: { label: `${planName}, ending`, variant: "testMode" }, text: `You cancelled your plan. It stays active until ${end}, then your store pauses.` }
        : { badge: { label: planName, variant: "live" }, text: end ? `Your ${planName} plan renews on ${end}.` : `You are on the ${planName} plan.` };
    case "past_due":
      return { badge: { label: "Payment failed", variant: "testMode" }, text: "Your last payment didn't go through. Stripe will try again; update your card under Manage billing so your store stays open." };
    case "founding":
      return { badge: { label: "Founding creator", variant: "live" }, text: `Free until ${end}. Pick a plan any time before then to keep your store open afterwards.` };
    case "paused":
      return { badge: { label: "Paused", variant: "draft" }, text: "Your store is hidden from buyers and checkout is off until you pick a plan. Nothing is deleted." };
    case "trial":
      return end
        ? { badge: { label: "Free trial", variant: "testMode" }, text: `Your ${TRIAL_DAYS}-day free trial ends on ${end}. Pick a plan before then and nothing pauses.` }
        : { badge: { label: "Free trial", variant: "testMode" }, text: "You are on the free trial." };
  }
}

async function PlanContent({ searchParams }: Pick<PageProps<"/dashboard/settings/plan">, "searchParams">) {
  const [{ user, store }, params] = await Promise.all([requireCreator("/dashboard/settings/plan"), searchParams]);
  const billing = await billingOfOwner(user.id);
  const status = statusOf(store.access);
  const outcomeKey = typeof params.billing === "string" && Object.hasOwn(OUTCOMES, params.billing) ? params.billing : null;
  const outcome = outcomeKey ? OUTCOMES[outcomeKey] : null;
  const current = store.access.plan;
  const ready = billingConfigured();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-h3">Plan</h2>
          <Badge variant={status.badge.variant}>{status.badge.label}</Badge>
          {ready && !liveKey() && <Badge variant="testMode">Test mode</Badge>}
        </div>
        <p className="text-sm text-mute">{status.text}</p>
      </CardHeader>

      {outcome && (
        <Alert variant={outcome.variant}>
          <AlertDescription>{outcome.text}</AlertDescription>
        </Alert>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {PAID_PLANS.map((plan) => {
          const isCurrent = current === plan;
          return (
            <li key={plan} className={`flex flex-col gap-3 rounded-md border p-4 ${isCurrent ? "border-blue bg-blue-soft" : "border-line"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{PLAN_LABELS[plan].name}</span>
                {isCurrent && (
                  <Badge variant="live">
                    <Check aria-hidden="true" className="size-3.5" />
                    Current
                  </Badge>
                )}
              </div>
              <span className="font-display text-money-m tabular-nums">
                {formatWholeDollars(PLANNED_PRICE_CENTS[plan])}
                <span className="text-sm font-normal text-mute"> / month</span>
              </span>
              <span className="text-sm text-mute">{PLAN_LABELS[plan].blurb} 0% transaction fees.</span>
              {!isCurrent && (
                <form action={startSubscription.bind(null, plan)}>
                  <Button type="submit" variant={plan === "pro" ? "default" : "secondary"} className="w-full" disabled={!ready}>
                    {current ? `Switch to ${PLAN_LABELS[plan].name}` : `Choose ${PLAN_LABELS[plan].name}`}
                  </Button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      {billing?.customerId && (
        <form action={openBillingPortal}>
          <Button type="submit" variant="secondary" disabled={!ready}>
            Manage billing
          </Button>
        </form>
      )}

      <p className="text-sm text-mute">
        Payment is handled by Stripe; Pickstall never sees your card. Cancel any time in Manage billing: your plan stays active until the end of the paid
        month. Stripe&apos;s card processing fees on your own sales still apply. Questions:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-blue underline underline-offset-4">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </Card>
  );
}
