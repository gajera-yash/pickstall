import { AlertTriangle, CalendarClock, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { CallRow } from "@/lib/coaching/calls";
import { formatCallTime } from "@/lib/coaching/ics";

/**
 * Upcoming coaching calls at the top of Orders (D-086): soonest first, in the coach's time zone,
 * with "Needs a new time" for a conflict. Each row opens the order drawer, where the call can be
 * cancelled. Shown only when the store has upcoming calls.
 */
export function UpcomingCalls({ calls, hrefFor }: { calls: CallRow[]; hrefFor: (orderId: string) => string }) {
  if (calls.length === 0) return null;
  return (
    <section aria-labelledby="upcoming-calls-title" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <h2 id="upcoming-calls-title" className="flex items-center gap-2 font-display text-h4">
        <CalendarClock aria-hidden="true" className="size-5 text-blue" />
        Upcoming calls
      </h2>
      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
        {calls.map((call) => (
          <li key={call.orderId}>
            <Link href={hrefFor(call.orderId)} scroll={false} className="flex items-center gap-3 px-4 py-3 transition-colors duration-(--dur-fast) hover:bg-bg-subtle">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{call.buyerName}</span>
                  {call.status === "conflict" && (
                    <Badge variant="testMode">
                      <AlertTriangle aria-hidden="true" className="size-3.5" />
                      Needs a new time
                    </Badge>
                  )}
                </span>
                <span className="text-sm text-mute">
                  {call.productTitle} · {formatCallTime(call.start, call.end, call.timeZone)}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-mute" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
