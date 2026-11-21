import { Suspense } from "react";

import { PaymentsConnection, paypalSandbox, providerLabel } from "@/components/dashboard/payments-connection";
import { stripeOutcomeOf } from "@/components/dashboard/stripe-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { activeProvider } from "@/lib/payments/paypal-config";
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
  const provider = providerLabel();
  const testMode = activeProvider() === "stripe" ? !liveKey() : paypalSandbox();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-h3">Payments</h2>
          {/* Test mode (PayPal sandbox) until the founder approves live mode (CLAUDE.md section 9). */}
          {testMode && <Badge variant="testMode">Test mode</Badge>}
        </div>
        <p className="text-sm text-mute">Buyers pay you directly through your own {provider} account. Pickstall never holds your money.</p>
      </CardHeader>

      <PaymentsConnection store={store} returnTo="settings" stripeOutcome={stripeOutcomeOf(params.stripe)} />

      <p className="text-sm text-mute">
        Pickstall takes 0% of your sales. {provider}&apos;s payment processing fees still apply. Buyers can pay with their {provider} account
        {provider === "PayPal" ? " or, where PayPal offers it, a card" : ", cards and other methods your Stripe account allows"}.
      </p>
      <p className="text-sm text-mute">Refunds come out of your own {provider} balance. You are the seller of record for your sales.</p>
    </Card>
  );
}
