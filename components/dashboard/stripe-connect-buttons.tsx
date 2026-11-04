"use client";

import { CreditCard, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { connectStripeTestAccount, disconnectStripe, startStripeConnect } from "@/lib/stores/actions";

/**
 * Connect or disconnect Stripe (D-053). "Connect Stripe" opens Stripe Connect OAuth; in test mode
 * "Use test Stripe account" can also connect the founder's own test account (D-034).
 */
export function StripeConnectButtons({
  connected,
  connectAvailable,
  testAvailable,
  returnTo,
  continueHref,
}: {
  connected: boolean;
  connectAvailable: boolean;
  testAvailable: boolean;
  /** Where Stripe sends the creator back to. */
  returnTo: "settings" | "setup";
  /** In the setup wizard: where to go once connected, so the next step opens by itself (D-045). */
  continueHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const connect = () => {
    setProblem(null);
    startTransition(async () => {
      const result = await startStripeConnect(returnTo);
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      window.location.assign(result.data.url); // Stripe's own page; it sends the creator back to our callback
    });
  };

  const useTestAccount = () => {
    setProblem(null);
    startTransition(async () => {
      const result = await connectStripeTestAccount();
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      if (continueHref) router.push(continueHref);
      router.refresh();
    });
  };

  const disconnect = () => {
    setProblem(null);
    startTransition(async () => {
      const result = await disconnectStripe();
      setConfirming(false);
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (connected) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button type="button" variant="secondary" onClick={() => setConfirming(true)} disabled={pending}>
          <Unplug aria-hidden="true" className="size-4" />
          Disconnect
        </Button>
        {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
        <Dialog open={confirming} onOpenChange={(open) => !pending && setConfirming(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disconnect Stripe?</DialogTitle>
              <DialogDescription>
                Your paid products go back to draft, because buyers can&apos;t pay for them without Stripe. Free products stay live. Past orders and
                buyers&apos; access are not affected.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="button" variant="destructive" onClick={disconnect} loading={pending}>
                Disconnect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {connectAvailable ? (
          <Button type="button" onClick={connect} loading={pending}>
            <CreditCard aria-hidden="true" className="size-5" />
            Connect Stripe
          </Button>
        ) : (
          !testAvailable && (
            <>
              <span aria-disabled="true" className="inline-flex h-11 items-center gap-2 rounded-md border border-line px-4 text-button text-mute">
                <CreditCard aria-hidden="true" className="size-5" />
                Connect Stripe
              </span>
              <Badge variant="soon">Coming soon</Badge>
            </>
          )
        )}
        {testAvailable && (
          <Button type="button" variant={connectAvailable ? "secondary" : "default"} onClick={useTestAccount} disabled={pending}>
            {!connectAvailable && <CreditCard aria-hidden="true" className="size-5" />}
            Use test Stripe account
          </Button>
        )}
      </div>
      {testAvailable && <p className="text-sm text-mute">Test mode only. No real money moves.</p>}
      {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
    </div>
  );
}
