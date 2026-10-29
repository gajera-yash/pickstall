import { CheckCircle2, ChevronRight, Circle, CreditCard, ImageIcon, Package, Rocket, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ChecklistItem, ChecklistItemId } from "@/lib/dashboard/checklist";
import { cn } from "@/lib/utils";

const STEP_ICONS: Record<ChecklistItemId, LucideIcon> = {
  "store-setup": ImageIcon,
  "first-product": Package,
  "connect-payments": CreditCard,
  publish: Rocket,
};

/**
 * First-run checklist (DESIGN.md 10.8, reference docs/ui-reference/dashboard.webp): "Get started",
 * "1 of 4 completed" with a progress bar, then one row per step with a status circle, a step icon,
 * the title, one line of help and a chevron. The next step is highlighted; done steps get a mint
 * check. Steps whose screen is not built yet say "Coming next" instead of linking.
 */
export function ChecklistCard({ items, next, doneCount }: { items: ChecklistItem[]; next: ChecklistItem | null; doneCount: number }) {
  const progressText = `${doneCount} of ${items.length} completed`;

  return (
    <Card className="gap-4">
      <section id="get-started" aria-labelledby="checklist-title" className="flex scroll-mt-24 flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="checklist-title" className="font-display text-h3">
              Get started
            </h2>
            <p className="text-sm font-medium text-mute">{progressText}</p>
          </div>
          <Progress value={doneCount} max={items.length} aria-label="Setup progress" aria-valuetext={progressText} />
        </div>

        <ol className="flex flex-col gap-1">
          {items.map((item) => {
            const isNext = next?.id === item.id;
            const StepIcon = STEP_ICONS[item.id];
            const content = (
              <>
                {item.done ? (
                  <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 fill-mint text-surface" />
                ) : (
                  <Circle aria-hidden="true" className={cn("size-5 shrink-0", isNext ? "text-blue" : "text-mute")} />
                )}
                <StepIcon aria-hidden="true" className={cn("size-5 shrink-0", item.done ? "text-mute" : "text-ink")} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("flex flex-wrap items-center gap-2 font-semibold", item.done && "text-mute line-through decoration-1")}>
                    {item.label}
                    <span className="sr-only">{item.done ? "(done)" : isNext ? "(next step)" : "(not done)"}</span>
                    {!item.done && !item.available && <Badge variant="soon">Coming next</Badge>}
                  </span>
                  <span className="text-sm text-mute">{item.description}</span>
                </span>
              </>
            );
            const rowClass = cn("flex min-h-16 items-center gap-3 rounded-md px-3 py-2.5", isNext && "bg-blue-soft");

            return (
              <li key={item.id}>
                {item.available && !item.done ? (
                  <Link href={item.href} className={cn(rowClass, "transition-colors duration-(--dur-fast)", !isNext && "hover:bg-bg-subtle")}>
                    {content}
                    <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-mute" />
                  </Link>
                ) : (
                  <div className={rowClass}>
                    {content}
                    {!item.done && <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-mute/40" />}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </Card>
  );
}
