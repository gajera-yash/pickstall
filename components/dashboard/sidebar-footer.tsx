import { Check, ChevronRight, Crown } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";

const PRO_PERKS = ["Lower fees", "Custom domain", "Advanced analytics"] as const;

/**
 * Bottom of the sidebar (reference docs/ui-reference/dashboard.webp): the Pro plan card and the
 * signed-in creator. Paid plans arrive in Phase 3 (PRD F9), so the card says so instead of
 * offering a checkout that does not exist yet.
 */
export function SidebarFooter({ displayName }: { displayName: string }) {
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="mt-auto flex flex-col gap-3">
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
        <p className="flex items-center justify-between gap-2 rounded-md bg-surface px-3 py-2 text-sm font-semibold text-ink">
          Pro plans
          <Badge variant="soon">Coming soon</Badge>
        </p>
      </section>

      <Link
        href="/dashboard/settings/account"
        className="flex items-center gap-3 rounded-md p-2 transition-colors duration-(--dur-fast) hover:bg-bg-subtle"
      >
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-soft font-display text-base font-bold text-ink">
          {initial}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold text-ink">{displayName}</span>
          <span className="text-sm text-mute">Free plan</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-4 text-mute" />
      </Link>
    </div>
  );
}
