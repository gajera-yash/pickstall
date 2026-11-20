import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TRIAL_WARNING_DAYS } from "@/lib/config";
import { SUSPENDED_MESSAGE, type StoreAccess } from "@/lib/plans/access";

/** "Nov 15, 2026" in the creator's view (DESIGN.md 15). UTC, so server and client agree. */
export function formatPlanDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

const PLAN_PATH = "/dashboard/settings/plan";

function dayWord(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

function PlanLink({ children }: { children: string }) {
  return (
    <Link href={PLAN_PATH} className="font-semibold underline underline-offset-4">
      {children}
    </Link>
  );
}

/**
 * Plan notice at the top of the dashboard (D-072, D-073). Quiet while all is well; a warning near the
 * end of a free period, when a payment failed or when a cancelled plan is about to end; an error once
 * the store is paused.
 */
export function TrialBanner({ access }: { access: StoreAccess }) {
  switch (access.state) {
    case "suspended":
      return (
        <Alert variant="error">
          <AlertTitle>Your store is suspended</AlertTitle>
          <AlertDescription>{SUSPENDED_MESSAGE} Buyers can&apos;t open it or check out; nothing is deleted.</AlertDescription>
        </Alert>
      );
    case "paused":
      return (
        <Alert variant="error">
          <AlertTitle>Your store is paused</AlertTitle>
          <AlertDescription>
            Buyers can&apos;t open it or check out. Your products, orders and customers are safe. <PlanLink>Choose a plan to reopen it</PlanLink>
          </AlertDescription>
        </Alert>
      );
    case "past_due":
      return (
        <Alert variant="warning">
          <AlertTitle>Your last payment didn&apos;t go through</AlertTitle>
          <AlertDescription>
            Stripe will try again. Update your card so your store stays open. <PlanLink>Update payment</PlanLink>
          </AlertDescription>
        </Alert>
      );
    case "active":
      if (!access.cancelsAtPeriodEnd || !access.endsAt || access.daysLeft === null || access.daysLeft > 7) return null;
      return (
        <Alert variant="warning">
          <AlertTitle>Your plan ends in {dayWord(access.daysLeft)}</AlertTitle>
          <AlertDescription>
            You cancelled it; it stays active until {formatPlanDate(access.endsAt)}, then your store pauses. <PlanLink>Keep my plan</PlanLink>
          </AlertDescription>
        </Alert>
      );
    case "founding":
      if (!access.endsAt || access.daysLeft === null || access.daysLeft > 14) return null;
      return (
        <Alert variant="warning">
          <AlertTitle>Your founding period ends in {dayWord(access.daysLeft)}</AlertTitle>
          <AlertDescription>
            Free until {formatPlanDate(access.endsAt)}. <PlanLink>Choose a plan</PlanLink>
          </AlertDescription>
        </Alert>
      );
    case "trial": {
      if (!access.endsAt || access.daysLeft === null) return null;
      const ending = access.daysLeft <= TRIAL_WARNING_DAYS;
      return (
        <Alert variant={ending ? "warning" : "info"}>
          <AlertTitle>Free trial: {dayWord(access.daysLeft)} left</AlertTitle>
          <AlertDescription>
            Your trial ends on {formatPlanDate(access.endsAt)}. After that your store pauses until you pick a plan. <PlanLink>See plans</PlanLink>
          </AlertDescription>
        </Alert>
      );
    }
  }
}
