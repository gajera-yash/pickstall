"use client";

import { CreditCard, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { connectStripeTestAccount, disconnectStripe } from "@/lib/stores/actions";

/**
 * Connect or disconnect Stripe. Real Stripe Connect OAuth needs a Connect client id and arrives later;
 * until then, with a test key on the server, "Use test Stripe account" connects the founder's own test
 * account (D-034), so real Stripe Checkout can be tried in test mode.
 */
export function StripeConnectButtons({
  connected,
  testAvailable,
  continueHref,
}: {
  connected: boolean;
  testAvailable: boolean;
  /** In the setup wizard: where to go once connected, so the next step opens by itself (D-045). */
  continueHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setProblem(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setProblem(result.error ?? "Something went wrong.");
        return;
      }
      if (continueHref && action === connectStripeTestAccount) router.push(continueHref);
      router.refresh();
    });
  };

  if (connected) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button type="button" variant="secondary" onClick={() => run(disconnectStripe)} loading={pending}>
          <Unplug aria-hidden="true" className="size-4" />
          Disconnect
        </Button>
        {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {testAvailable ? (
          <Button type="button" onClick={() => run(connectStripeTestAccount)} loading={pending}>
            <CreditCard aria-hidden="true" className="size-5" />
            Use test Stripe account
          </Button>
        ) : (
          <>
            <span aria-disabled="true" className="inline-flex h-11 items-center gap-2 rounded-md border border-line px-4 text-button text-mute">
              <CreditCard aria-hidden="true" className="size-5" />
              Connect Stripe
            </span>
            <Badge variant="soon">Coming soon</Badge>
          </>
        )}
      </div>
      {testAvailable && <p className="text-sm text-mute">Test mode only. No real money moves.</p>}
      {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
    </div>
  );
}
