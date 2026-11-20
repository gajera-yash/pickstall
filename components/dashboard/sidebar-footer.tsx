import { Check, ChevronRight, Crown } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PLAN_LIMITS } from "@/lib/config";
import type { StoreAccess } from "@/lib/plans/access";

const PLAN_PATH = "/dashboard/settings/plan";

// What Pro adds over Starter, from the plan limits (0% transaction fees is on every plan).
const PRO_PERKS = ["Unlimited courses", `${PLAN_LIMITS.pro.videoHours} hours of course video`, `${PLAN_LIMITS.pro.emailSubscribers.toLocaleString("en-US")} email subscribers`] as const;

/** The creator's plan in a few words, under their name. */
export function planStatusLabel(access: StoreAccess): string {
  switch (access.state) {
    case "trial":
      return "Free trial";
    case "founding":
      return "Founding creator";
    case "paused":
      return "Store paused";
    case "suspended":
      return "Store suspended";
    case "past_due":
      return "Payment due";
    case "active":
      return access.plan === "pro" ? "Pro plan" : "Starter plan";
  }
}

/**
 * Bottom of the sidebar (reference docs/ui-reference/dashboard.webp): the Pro plan card, hidden once
 * the creator is on Pro, and the signed-in creator with their plan status (D-073, D-076), or
 * "Store not set up" until setup is done (D-079).
 */
export function SidebarFooter({ displayName, access, storeSetUp }: { displayName: string; access: StoreAccess; storeSetUp: boolean }) {
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  const onPro = access.state === "active" && access.plan === "pro";
  return (
    <div className="mt-auto flex flex-col gap-3">
      {!onPro && (
      <section aria-labelledby="pro-title" className="flex flex-col gap-3 rounded-lg border border-line bg-bg-subtle p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-yellow-soft text-on-yellow">
            <Crown className="size-5 fill-yellow text-on-yellow" strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <p id="pro-title" className="font-semibold text-ink">
              Upgrade to Pro
            </p>
            <ul className="flex flex-col gap-1 text-sm text-mute">
              {PRO_PERKS.map((perk) => (
                <li key={perk} className="flex items-center gap-1.5">
                  <Check aria-hidden="true" className="size-4 text-mint" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Button asChild size="sm" className="w-full">
          <Link href={PLAN_PATH}>See plans</Link>
        </Button>
      </section>
      )}

      <Link
        href="/dashboard/settings/account"
        className="flex items-center gap-3 rounded-md p-2 transition-colors duration-(--dur-fast) hover:bg-bg-subtle"
      >
        <Avatar size="lg" aria-hidden="true" className="size-10">
          <AvatarFallback className="text-base">{initial}</AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold text-ink">{displayName}</span>
          <span className="text-sm text-mute">{storeSetUp ? planStatusLabel(access) : "Store not set up"}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 text-mute" />
      </Link>
    </div>
  );
}
