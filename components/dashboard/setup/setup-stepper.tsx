import { Check } from "lucide-react";
import Link from "next/link";

import { STEP_ICONS } from "@/components/dashboard/checklist-card";
import { Progress } from "@/components/ui/progress";
import type { Checklist, ChecklistItemId } from "@/lib/dashboard/checklist";
import { cn } from "@/lib/utils";

/** Short names for narrow screens, where the full step labels would be cut off. */
const SHORT_LABEL: Record<ChecklistItemId, string> = {
  "store-setup": "Store",
  "first-product": "Product",
  "connect-payments": "Payments",
  publish: "Publish",
};

/**
 * The wizard's top bar (D-045): "x of n done", a progress bar, then the four steps with what is done
 * and what is left. Every step is a link, so a creator can go back and change an earlier one.
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
      <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {items.map((item, index) => {
          const active = item.id === current;
          const Icon = STEP_ICONS[item.id];
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-md border px-3 py-2 transition-colors duration-(--dur-fast)",
                  active ? "border-blue bg-blue-soft" : "border-line hover:bg-bg-subtle",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                    item.done ? "bg-mint text-surface" : active ? "bg-blue text-on-blue" : "bg-bg-subtle text-mute",
                  )}
                >
                  {item.done ? <Check className="size-4" /> : index + 1}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Icon aria-hidden="true" className="hidden size-4 shrink-0 text-mute sm:block" />
                    <span className="truncate sm:hidden">{SHORT_LABEL[item.id]}</span>
                    <span className="hidden truncate sm:inline">{item.label}</span>
                  </span>
                  <span className={cn("text-xs", item.done ? "text-mint" : "text-mute")}>
                    {item.done ? "Done" : !item.available ? "Not available yet" : active ? "In progress" : "To do"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
