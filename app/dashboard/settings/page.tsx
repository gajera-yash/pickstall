import { CreditCard, UserRound } from "lucide-react";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/lib/auth/actions";
import { requireCreator } from "@/lib/auth/guards";

// Settings (D-011): account and payments. Billing arrives in Phase 3.
export default function SettingsPage() {
  return (
    <>
      <h1 className="font-display text-h1">Settings</h1>
      <Suspense fallback={<Skeleton className="h-56 w-full rounded-lg" />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  const { user, store } = await requireCreator("/dashboard/settings");

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="account-title" className="flex flex-col gap-3 rounded-lg border border-border-ui p-5 sm:p-6">
        <h2 id="account-title" className="flex items-center gap-2 font-display text-h3">
          <UserRound aria-hidden="true" className="size-5" />
          Account
        </h2>
        <p className="text-sm text-mute">
          Signed in as <strong className="font-semibold break-all text-ink">{user.email ?? "your account"}</strong>
        </p>
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </section>

      <section aria-labelledby="payments-title" className="flex flex-col gap-3 rounded-lg border border-border-ui p-5 sm:p-6">
        <h2 id="payments-title" className="flex items-center gap-2 font-display text-h3">
          <CreditCard aria-hidden="true" className="size-5" />
          Payments
        </h2>
        <p className="flex flex-wrap items-center gap-2 text-sm text-mute">
          {store.stripeChargesEnabled ? "Stripe is connected." : "Stripe is not connected yet."}
          {!store.stripeChargesEnabled && <Badge variant="soon">Connecting is coming next</Badge>}
        </p>
      </section>
    </div>
  );
}
