import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TRIAL_WARNING_DAYS } from "@/lib/config";
import type { StoreAccess } from "@/lib/plans/access";

/** "Nov 15, 2026" in the creator's view (DESIGN.md 15). UTC, so server and client agree. */
export function formatPlanDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

const PLAN_PATH = "/dashboard/settings/plan";

function dayWord(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * Trial and pause notice at the top of the dashboard (D-072). Quiet during most of the trial, a
 * warning near the end, and an error once the store is paused. Founding creators see it only in
 * their last two weeks.
 */
export function TrialBanner({ access }: { access: StoreAccess }) {
  if (access.state === "paused") {
    return (
      <Alert variant="error">
        <AlertTitle>Your free trial has ended</AlertTitle>
        <AlertDescription>
          Your store is paused: buyers can&apos;t open it or check out. Your products, orders and customers are safe.{" "}
          <Link href={PLAN_PATH} className="font-semibold underline underline-offset-4">
            Choose a plan to reopen it
          </Link>
        </AlertDescription>
      </Alert>
    );
  }
  if (!access.endsAt || access.daysLeft === null) return null;

  if (access.state === "founding") {
    if (access.daysLeft > 14) return null;
    return (
      <Alert variant="warning">
        <AlertTitle>Your founding period ends in {dayWord(access.daysLeft)}</AlertTitle>
        <AlertDescription>
          Free until {formatPlanDate(access.endsAt)}.{" "}
          <Link href={PLAN_PATH} className="font-semibold underline underline-offset-4">
            See plans
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  const ending = access.daysLeft <= TRIAL_WARNING_DAYS;
  return (
    <Alert variant={ending ? "warning" : "info"}>
      <AlertTitle>Free trial: {dayWord(access.daysLeft)} left</AlertTitle>
      <AlertDescription>
        Your trial ends on {formatPlanDate(access.endsAt)}. After that your store pauses until you pick a plan.{" "}
        <Link href={PLAN_PATH} className="font-semibold underline underline-offset-4">
          See plans
        </Link>
      </AlertDescription>
    </Alert>
  );
}
