import { Check, ChevronRight, CreditCard, Package, Rocket, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Checklist, ChecklistItemId } from "@/lib/dashboard/checklist";
import { cn } from "@/lib/utils";

export const STEP_ICONS: Record<ChecklistItemId, LucideIcon> = {
  "store-setup": Store,
  "first-product": Package,
  "connect-payments": CreditCard,
  publish: Rocket,
};

/**
 * "Get started" on My Store while setup is not finished (reference docs/ui-reference/dashboard.webp,
 * DESIGN.md 10.8, D-076): progress, then the four steps as rows. Each row opens its step on
 * /dashboard/setup; the next step is highlighted, done steps show a check, and a step this server
 * cannot do yet says so and does not block.
 */
export function ChecklistCard({ items, next, doneCount, requiredCount }: Checklist) {
  const progressText = `${doneCount} of ${requiredCount} completed`;

  return (
    <Card className="gap-4">
      <section id="get-started" aria-labelledby="checklist-title" className="flex scroll-mt-24 flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="checklist-title" className="font-display text-h3">
            Get started
          </h2>
          <p className="text-sm text-mute">{progressText}</p>
        </div>
        <Progress value={doneCount} max={requiredCount} aria-label="Setup progress" aria-valuetext={progressText} />

        <ol className="flex flex-col gap-1">
          {items.map((item) => {
            const isNext = next?.id === item.id;
            const Icon = STEP_ICONS[item.id];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={isNext ? "step" : undefined}
                  className={cn(
                    "group flex min-h-16 items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-(--dur-fast)",
                    isNext ? "bg-blue-soft" : "hover:bg-bg-subtle",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                      item.done ? "border-mint bg-mint text-surface" : isNext ? "border-blue bg-surface" : "border-line bg-surface",
                    )}
                  >
                    {item.done && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <Icon aria-hidden="true" className={cn("size-5 shrink-0", item.done ? "text-mint" : isNext ? "text-blue" : "text-ink")} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn("flex flex-wrap items-center gap-2 text-sm font-semibold", item.done ? "text-mute line-through decoration-1" : "text-ink")}>
                      {item.label}
                      {!item.done && !item.available && <Badge variant="soon">Coming soon</Badge>}
                    </span>
                    <span className="text-xs text-mute">{item.description}</span>
                    <span className="sr-only">{item.done ? "(done)" : isNext ? "(next step)" : "(not done)"}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-mute transition-transform duration-(--dur-fast) group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </Card>
  );
}
