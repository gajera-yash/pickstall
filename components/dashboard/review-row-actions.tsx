"use client";

import { Eye, EyeOff, MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteReviewAction, hideReviewAction, showReviewAction } from "@/lib/reviews/actions";

/** The "..." menu on a review (D-106): Hide or Show on the product page, or Delete (asks first). */
export function ReviewRowActions({ review }: { review: { id: string; buyerName: string; hidden: boolean } }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (action: (id: string) => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const result = await action(review.id);
      setConfirming(false);
      if (!result.ok) setProblem(result.error ?? "That didn't work.");
      else router.refresh();
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Actions for the review by ${review.buyerName}`} className="shrink-0 rounded-full" loading={pending}>
            {!pending && <MoreHorizontal aria-hidden="true" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {review.hidden ? (
            <DropdownMenuItem onSelect={() => run(showReviewAction)}>
              <Eye aria-hidden="true" />
              Show on product page
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => run(hideReviewAction)}>
              <EyeOff aria-hidden="true" />
              Hide
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {problem && (
        <span role="alert" className="text-xs text-danger">
          {problem}
        </span>
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this review?</DialogTitle>
            <DialogDescription>It is removed for good. The buyer can write a new one. To keep it but take it off your page, use Hide instead.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => run(deleteReviewAction)} loading={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
