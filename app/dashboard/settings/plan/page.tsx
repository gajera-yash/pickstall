import { Suspense } from "react";

import { formatPlanDate } from "@/components/dashboard/trial-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { PLANNED_PRICE_CENTS, SUPPORT_EMAIL, TRIAL_DAYS } from "@/lib/config";
import { formatWholeDollars } from "@/lib/landing/demo";
import type { StoreAccess } from "@/lib/plans/access";

// Settings > Plan (D-072): the free trial or founding period, and what happens when it ends. Paid
// plans and the subscribe buttons arrive with billing (Phase C).
export default function PlanSettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
      <PlanContent />
    </Suspense>
  );
}

function statusOf(access: StoreAccess): { badge: { label: string; variant: "live" | "testMode" | "draft" }; text: string } {
  const end = access.endsAt ? formatPlanDate(access.endsAt) : null;
  switch (access.state) {
    case "founding":
      return { badge: { label: "Founding creator", variant: "live" }, text: `Free until ${end}. Thank you for being one of the first creators.` };
    case "paused":
      return {
        badge: { label: "Paused", variant: "draft" },
        text: `Your free trial ended on ${end}. Your store is hidden from buyers and checkout is off until you pick a plan. Nothing is deleted.`,
      };
    case "trial":
      return end
        ? { badge: { label: "Free trial", variant: "testMode" }, text: `Your ${TRIAL_DAYS}-day free trial ends on ${end}. After that your store pauses until you pick a plan.` }
        : { badge: { label: "Free trial", variant: "testMode" }, text: "You are on the free trial." };
  }
}

async function PlanContent() {
  const { store } = await requireCreator("/dashboard/settings/plan");
  const status = statusOf(store.access);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-h3">Plan</h2>
          <Badge variant={status.badge.variant}>{status.badge.label}</Badge>
        </div>
        <p className="text-sm text-mute">{status.text}</p>
      </CardHeader>

      <ul className="grid gap-3 sm:grid-cols-2">
        {(["starter", "pro"] as const).map((plan) => (
          <li key={plan} className="flex flex-col gap-1 rounded-md border border-line p-4">
            <span className="font-semibold capitalize">{plan}</span>
            <span className="font-display text-money-m tabular-nums">
              {formatWholeDollars(PLANNED_PRICE_CENTS[plan])}
              <span className="text-sm font-normal text-mute"> / month</span>
            </span>
            <span className="text-sm text-mute">0% transaction fees. Stripe&apos;s card processing fees still apply.</span>
          </li>
        ))}
      </ul>

      <p className="text-sm text-mute">
        Paid plans open with the next update. Until then, if your trial is ending and you want to keep selling, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-blue underline underline-offset-4">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </Card>
  );
}
