import { CalendarPlus, Clock, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCallTime } from "@/lib/coaching/ics";
import type { Purchase } from "@/lib/library/queries";

type Call = NonNullable<Purchase["call"]>;

/**
 * A booked coaching call in the buyer's library (D-084): its time (in the zone the buyer booked
 * from), the meeting link once confirmed, and "Add to calendar". A "conflict" booking says the coach
 * will get in touch to pick a new time.
 */
export function CallCard({ orderId, call, storeName, refunded }: { orderId: string; call: Call; storeName: string; refunded: boolean }) {
  const when = formatCallTime(call.start, call.end, call.buyerTimeZone ?? call.coachTimeZone);
  const past = call.ended;

  if (call.status === "cancelled") {
    return <p className="rounded-lg border border-line bg-bg-subtle px-4 py-3 text-mute">{storeName} cancelled this call ({when}). {refunded ? "It was refunded in full." : "If you paid, your refund is on its way."}</p>;
  }
  if (refunded) return <p className="rounded-lg border border-line bg-bg-subtle px-4 py-3 text-mute">This booking was refunded, so the call is cancelled.</p>;
  if (call.status === "conflict" || call.status === "released") {
    return (
      <p className="rounded-lg border border-line bg-bg-subtle px-4 py-3 text-mute">
        Your payment is confirmed, but the time you picked ({when}) was taken. {storeName} will contact you to choose a new time.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <p className="flex items-start gap-2">
        <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue" />
        <span>
          <span className="block text-sm text-mute">{past ? "Your call was on" : "Your call"}</span>
          <span className="font-semibold">{when}</span>
        </span>
      </p>
      {call.status === "confirmed" && !past && (
        <div className="flex flex-wrap gap-3">
          {call.meetingUrl ? (
            <Button asChild>
              <a href={call.meetingUrl} target="_blank" rel="noopener noreferrer">
                <Video aria-hidden="true" className="size-5" />
                Join the call
              </a>
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <a href={`/library/${orderId}/call.ics`} download="call.ics">
              <CalendarPlus aria-hidden="true" className="size-5" />
              Add to calendar
            </a>
          </Button>
        </div>
      )}
      {call.status === "confirmed" && !call.meetingUrl && !past && <p className="text-sm text-mute">{storeName} will email you the meeting link before the call.</p>}
      {call.status === "held" && <p className="text-sm text-mute">We are confirming your booking. Refresh this page in a minute.</p>}
    </div>
  );
}
