import { ArrowRight, Check, CreditCard, Package, Pencil, Rocket, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
 * The setup checklist on My Store while setup is not finished (DESIGN.md 10.8, D-045): progress,
 * then the four steps as a numbered timeline. The next step is open with its button; done steps
 * show a check and an Edit link; a step this server cannot do yet says so and does not block.
 */
export function ChecklistCard({ items, next, doneCount, requiredCount }: Checklist) {
  const progressText = `${doneCount} of ${requiredCount} done`;

  return (
    <Card className="gap-6 p-5 sm:p-8">
      <section id="get-started" aria-labelledby="checklist-title" className="flex scroll-mt-24 flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <h2 id="checklist-title" className="font-display text-h2">
              Finish setting up your store
            </h2>
            <p className="text-mute">A few short steps, one at a time. Your dashboard opens up when they are done.</p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-mute">{progressText}</p>
        </div>
        <Progress value={doneCount} max={requiredCount} aria-label="Setup progress" aria-valuetext={progressText} />

        <ol className="flex flex-col">
          {items.map((item, index) => {
            const isNext = next?.id === item.id;
            const Icon = STEP_ICONS[item.id];
            const last = index === items.length - 1;
            return (
              <li key={item.id} className="relative flex gap-4">
                {/* The line that joins the step circles. */}
                {!last && <span aria-hidden="true" className={cn("absolute top-11 bottom-0 left-5 w-0.5 -translate-x-1/2", item.done ? "bg-mint" : "bg-line")} />}
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 font-display text-sm font-extrabold",
                    item.done ? "border-mint bg-mint text-surface" : isNext ? "border-blue bg-blue text-on-blue" : "border-line bg-surface text-mute",
                  )}
                >
                  {item.done ? <Check className="size-5" /> : index + 1}
                </span>

                <div className={cn("mb-4 flex min-w-0 flex-1 flex-col gap-3 rounded-lg border p-4", isNext ? "border-blue bg-blue-soft/60" : "border-transparent")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon aria-hidden="true" className={cn("size-5 shrink-0", item.done ? "text-mint" : isNext ? "text-blue" : "text-mute")} />
                    <h3 className={cn("font-display text-h4", item.done && "text-mute")}>{item.label}</h3>
                    <span className="sr-only">{item.done ? "(done)" : isNext ? "(next step)" : "(not done)"}</span>
                    {item.done && <Badge variant="live">Done</Badge>}
                    {!item.done && !item.available && <Badge variant="soon">Coming soon</Badge>}
                  </div>
                  <p className="text-sm text-mute">{item.description}</p>
                  {isNext ? (
                    <Button asChild className="self-start">
                      <Link href={item.href}>
                        {doneCount === 0 ? "Start" : "Continue"}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : item.done ? (
                    <Link href={item.href} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-blue hover:text-blue-hover">
                      <Pencil aria-hidden="true" className="size-4" />
                      Edit
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </Card>
  );
}
