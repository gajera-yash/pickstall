"use client";

import { MailX, MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteSubscriberAction, unsubscribeSubscriberAction } from "@/lib/subscribers/actions";

/**
 * The "..." menu on a subscriber row (D-094): Unsubscribe (they stay on the list, marked so, and
 * get no emails) or Delete (for a data request; asks first).
 */
export function SubscriberRowActions({ subscriber }: { subscriber: { id: string; email: string; subscribed: boolean } }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (action: (id: string) => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const result = await action(subscriber.id);
      setConfirming(false);
      if (!result.ok) setProblem(result.error ?? "That didn't work. Try again.");
      else router.refresh();
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${subscriber.email}`} className="relative z-10 shrink-0 rounded-full" loading={pending}>
            {!pending && <MoreHorizontal aria-hidden="true" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {subscriber.subscribed && (
            <>
              <DropdownMenuItem onSelect={() => run(unsubscribeSubscriberAction)}>
                <MailX aria-hidden="true" />
                Unsubscribe
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => setConfirming(true)} className="text-danger focus:text-danger">
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {subscriber.email}?</DialogTitle>
            <DialogDescription>They are removed from your list for good. Their orders stay. Use this when someone asks you to delete their data.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => run(deleteSubscriberAction)} loading={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={problem !== null} onOpenChange={(open) => !open && setProblem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>That didn&apos;t work</DialogTitle>
            <DialogDescription className="sr-only">What went wrong</DialogDescription>
          </DialogHeader>
          <Alert variant="error">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setProblem(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
