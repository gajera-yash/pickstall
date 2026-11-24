import { Suspense } from "react";

import { PaymentsConnection, paypalSandbox } from "@/components/dashboard/payments-connection";
import { stripeOutcomeOf } from "@/components/dashboard/stripe-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { liveKey } from "@/lib/payments/test-account";

// Settings > Payments (PRD F8, D-053, D-118): status, test mode badge, connect or disconnect, and the fees note.
export default function PaymentsSettingsPage({ searchParams }: PageProps<"/dashboard/settings/payments">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
      <PaymentsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PaymentsContent({ searchParams }: { searchParams: PageProps<"/dashboard/settings/payments">["searchParams"] }) {
  const [{ store }, params] = await Promise.all([requireUnlockedCreator("/dashboard/settings/payments"), searchParams]);
  const testMode = !liveKey() || paypalSandbox();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-h3">Payments</h2>
          {/* Test mode badge until live mode is approved. */}
          {testMode && <Badge variant="testMode">Test mode</Badge>}
        </div>
        <p className="text-sm text-mute">
          Connect Stripe or PayPal so buyers pay you directly into your account. Pickstall never holds your money.
        </p>
      </CardHeader>

      <PaymentsConnection store={store} returnTo="settings" stripeOutcome={stripeOutcomeOf(params.stripe)} />

      <p className="text-sm text-mute">
        Pickstall takes 0% of your sales. The payment processing fees of your connected provider still apply.
      </p>
      <p className="text-sm text-mute">Refunds come out of your connected account balance. You are the seller of record for your sales.</p>
    </Card>
  );
}
