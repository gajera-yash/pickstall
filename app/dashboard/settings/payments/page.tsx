import { Suspense } from "react";

import { StripeStatus, stripeOutcomeOf } from "@/components/dashboard/stripe-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { liveKey } from "@/lib/payments/test-account";

// Settings > Payments (PRD F8, D-053): status, test mode badge, connect or disconnect, and the payment-methods note.
export default function PaymentsSettingsPage({ searchParams }: PageProps<"/dashboard/settings/payments">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
      <PaymentsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PaymentsContent({ searchParams }: { searchParams: PageProps<"/dashboard/settings/payments">["searchParams"] }) {
  const [{ store }, params] = await Promise.all([requireUnlockedCreator("/dashboard/settings/payments"), searchParams]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-h3">Payments</h2>
          {/* Stripe test mode until the founder approves live mode (CLAUDE.md section 9). */}
          {!liveKey() && <Badge variant="testMode">Test mode</Badge>}
        </div>
        <p className="text-sm text-mute">Buyers pay you directly through your own Stripe account. Pickstall never holds your money.</p>
      </CardHeader>

      <StripeStatus store={store} returnTo="settings" outcome={stripeOutcomeOf(params.stripe)} />

      <p className="text-sm text-mute">
        Pickstall takes 0% of your sales. Stripe&apos;s card processing fees still apply. The payment methods buyers see (cards, wallets and
        more) depend on your Stripe account, country and currency. You choose them in your Stripe Dashboard under Payment methods.
      </p>
      <p className="text-sm text-mute">Refunds come out of your own Stripe balance. You are the seller of record for your sales.</p>
    </Card>
  );
}
