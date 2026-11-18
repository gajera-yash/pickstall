import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { SETUP_STEP_META, StepTile } from "@/components/dashboard/setup/step-tile";
import { Progress } from "@/components/ui/progress";
import type { Checklist, ChecklistItemId } from "@/lib/dashboard/checklist";
import { cn } from "@/lib/utils";

/**
 * The wizard's top bar (D-045, restyled in D-080 to match the onboarding screen): "x of n done", a
 * progress bar, then the four steps as icon tiles with number badges and chevrons between them.
 * Every step is a link, so a creator can go back and change an earlier one.
 */
export function SetupStepper({ checklist, current }: { checklist: Checklist; current: ChecklistItemId }) {
  const { items, doneCount, requiredCount } = checklist;
  const progressText = `${doneCount} of ${requiredCount} done`;

  return (
    <nav aria-label="Setup steps" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{progressText}</p>
        <p className="text-sm text-mute">{doneCount === requiredCount ? "All set" : `${requiredCount - doneCount} to go`}</p>
      </div>
      <Progress value={doneCount} max={requiredCount} aria-label="Setup progress" aria-valuetext={progressText} />
      <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-8">
        {items.map((item, index) => {
          const active = item.id === current;
          const last = index === items.length - 1;
          const status = item.done ? "Done" : !item.available ? "Not needed yet" : active ? "In progress" : "To do";
          return (
            <li key={item.id} className="relative">
              <Link
                href={item.href}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex h-full flex-col items-start gap-3 rounded-lg border border-line p-3 pt-4 transition-colors duration-(--dur-fast) sm:flex-row sm:items-center",
                  active ? "bg-blue-soft" : "bg-surface hover:bg-bg-subtle",
                )}
              >
                <StepTile id={item.id} number={index + 1} done={item.done} current={active} size="sm" onTint />
                <span className="flex min-w-0 flex-col">
                  <span className="font-display text-h4 text-ink">{SETUP_STEP_META[item.id].title}</span>
                  <span className={cn("text-xs font-medium", item.done ? "text-mint" : active ? "text-blue" : "text-mute")}>{status}</span>
                </span>
              </Link>
              {!last && <ChevronRight aria-hidden="true" className="absolute top-1/2 -right-6 hidden size-4 -translate-y-1/2 text-mute lg:block" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
