import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ChecklistItem } from "@/lib/dashboard/checklist";
import { cn } from "@/lib/utils";

/**
 * First-run checklist (DESIGN.md 10.8): "Get started", a progress bar with "1 of 4 done", four rows
 * with a status icon, a one-line description and a chevron. Done rows show a mint check, the next
 * step is highlighted. Steps whose screen is not built yet say "Coming next" instead of linking.
 */
export function ChecklistCard({ items, next, doneCount }: { items: ChecklistItem[]; next: ChecklistItem | null; doneCount: number }) {
  const progressText = `${doneCount} of ${items.length} done`;

  return (
    <Card className="gap-4">
      <section aria-labelledby="checklist-title" className="flex flex-col gap-4">
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
            const content = (
              <>
                {item.done ? (
                  <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 fill-mint text-surface" />
                ) : (
                  <Circle aria-hidden="true" className={cn("size-5 shrink-0", isNext ? "text-blue" : "text-mute")} />
                )}
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
            const rowClass = cn("flex min-h-14 items-center gap-3 rounded-md px-3 py-2.5", isNext && "bg-blue-soft");

            return (
              <li key={item.id}>
                {item.available && !item.done ? (
                  <Link href={item.href} className={cn(rowClass, "transition-colors duration-(--dur-fast)", !isNext && "hover:bg-bg-subtle")}>
                    {content}
                    <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-mute" />
                  </Link>
                ) : (
                  <div className={rowClass}>{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </Card>
  );
}
