import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChecklistItem } from "@/lib/dashboard/checklist";

/**
 * First-run checklist (DESIGN.md 10.8): each step shows done or not done with an icon and text;
 * the one primary action is the next step that is not done. Steps whose screen is not built yet
 * say so plainly instead of linking somewhere empty.
 */
export function ChecklistCard({
  items,
  next,
  doneCount,
}: {
  items: ChecklistItem[];
  next: ChecklistItem | null;
  doneCount: number;
}) {
  return (
    <section aria-labelledby="checklist-title" className="flex flex-col gap-4 rounded-lg border border-border-ui p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="checklist-title" className="font-display text-h2">
          Get your store ready
        </h2>
        <p className="text-sm text-mute">
          {doneCount} of {items.length} done
        </p>
      </div>

      <ol className="flex flex-col divide-y divide-line">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 py-3">
            {item.done ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mint" />
            ) : (
              <Circle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mute" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {item.label}
                <span className="sr-only">{item.done ? "(done)" : "(not done)"}</span>
                {!item.done && !item.available && <Badge variant="soon">Coming next</Badge>}
              </p>
              <p className="text-sm text-mute">{item.description}</p>
            </div>
          </li>
        ))}
      </ol>

      {next ? (
        next.available ? (
          <Button asChild size="lg" className="self-start">
            <Link href={next.href}>{next.label}</Link>
          </Button>
        ) : (
          <p className="text-sm text-mute">
            Next: <strong className="font-semibold text-ink">{next.label}</strong>. This screen is coming in the next build.
          </p>
        )
      ) : (
        <p className="flex items-center gap-2 text-sm font-medium text-mint">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Your store is ready and live.
        </p>
      )}
    </section>
  );
}
