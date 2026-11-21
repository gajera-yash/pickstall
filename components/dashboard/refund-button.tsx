"use client";

import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { refundOrder } from "@/lib/orders/refund-actions";

/** Full refund of a paid order, after a confirmation (D-053). The order turns "Refunded" when the payment provider confirms it. */
export function RefundButton({ orderId, amount }: { orderId: string; amount: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  const refund = () => {
    setProblem(null);
    startTransition(async () => {
      const result = await refundOrder(orderId);
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
          <Undo2 aria-hidden="true" className="size-4" />
          Refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund {amount}?</DialogTitle>
          <DialogDescription>
            The buyer gets the full amount back from your Stripe balance and loses access to the product. Stripe&apos;s processing fee is not
            returned to you. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={refund} loading={pending}>
            Refund {amount}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
