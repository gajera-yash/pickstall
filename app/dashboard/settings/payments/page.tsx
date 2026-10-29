import { CheckCircle2, CircleDashed, CreditCard } from "lucide-react";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";

// Settings > Payments (PRD F8): status, test mode badge, payment-methods note. Connecting Stripe
// arrives in R5, so the button is an honest "Coming soon" for now.
export default function PaymentsSettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
      <PaymentsContent />
    </Suspense>
  );
}

async function PaymentsContent() {
  const { store } = await requireCreator("/dashboard/settings/payments");
  const connected = store.stripeChargesEnabled;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-h3">Payments</h2>
          {/* Stripe test mode until the founder approves live mode (CLAUDE.md section 9). */}
          <Badge variant="testMode">Test mode</Badge>
        </div>
        <p className="text-sm text-mute">Buyers pay you directly through your own Stripe account. Pickstall never holds your money.</p>
      </CardHeader>

      <div className="flex flex-col gap-3 rounded-md border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-3">
          {connected ? (
            <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 fill-mint text-surface" />
          ) : (
            <CircleDashed aria-hidden="true" className="size-5 shrink-0 text-mute" />
          )}
          <span className="flex flex-col">
            <span className="font-semibold">Stripe</span>
            <span className="text-sm text-mute">{connected ? "Connected. You can take payments." : "Not connected yet."}</span>
          </span>
        </p>
        {!connected && (
          <span className="inline-flex items-center gap-2 self-start sm:self-center">
            <span aria-disabled="true" className="inline-flex h-11 items-center gap-2 rounded-md border border-line px-4 text-button text-mute">
              <CreditCard aria-hidden="true" className="size-5" />
              Connect Stripe
            </span>
            <Badge variant="soon">Coming soon</Badge>
          </span>
        )}
      </div>

      <p className="text-sm text-mute">
        Pickstall takes 0% of your sales. Stripe&apos;s card processing fees still apply. The payment methods buyers see (cards, wallets and
        more) depend on your Stripe account and country.
      </p>
    </Card>
  );
}
