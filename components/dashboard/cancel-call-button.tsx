"use client";

import { CalendarX2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cancelCall } from "@/lib/coaching/call-actions";

/**
 * Cancels a coaching call after a confirmation (D-086). A paid call is refunded in full first; the
 * buyer gets an email and the time opens up again.
 */
export function CancelCallButton({ orderId, amount, paid }: { orderId: string; amount: string; paid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  const cancel = () => {
    setProblem(null);
    startTransition(async () => {
      const result = await cancelCall(orderId);
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className="self-start">
          <CalendarX2 aria-hidden="true" className="size-4" />
          {paid ? "Cancel call and refund" : "Cancel call"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{paid ? `Cancel this call and refund ${amount}?` : "Cancel this call?"}</DialogTitle>
          <DialogDescription>
            {paid
              ? "The buyer gets the full amount back from your Stripe balance and an email that the call is cancelled. Stripe's processing fee is not returned to you. The time opens up for new bookings. This can't be undone."
              : "The buyer gets an email that the call is cancelled, and the time opens up for new bookings. This can't be undone."}
          </DialogDescription>
        </DialogHeader>
        {problem && (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={pending}>
              Keep the call
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={cancel} loading={pending}>
            {paid ? `Cancel and refund ${amount}` : "Cancel call"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
