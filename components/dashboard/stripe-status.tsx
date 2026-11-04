import "server-only";

import { CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react";

import { StripeConnectButtons } from "@/components/dashboard/stripe-connect-buttons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { CreatorStore } from "@/lib/auth/guards";
import { connectAvailable } from "@/lib/payments/connect";
import { testSellerAccountId } from "@/lib/payments/test-account";

// The Stripe row shared by Settings > Payments and the setup wizard (D-053): status, connect or
// disconnect, and what happened on the way back from Stripe (`?stripe=` on the return page).

const OUTCOMES = {
  connected: { variant: "success", title: "Stripe is connected", text: "Buyers can now pay you through your own Stripe account." },
  cancelled: { variant: "info", title: "Stripe wasn't connected", text: "You left Stripe before finishing. Connect again whenever you're ready." },
  expired: { variant: "warning", title: "That link expired", text: "For your safety, a Stripe connection must finish within 10 minutes. Please connect again." },
  wrong_mode: { variant: "warning", title: "Wrong Stripe mode", text: "Pickstall is in test mode, so connect a Stripe account in test mode." },
  error: { variant: "error", title: "Couldn't connect Stripe", text: "Something went wrong on the way back from Stripe. Please try again." },
} as const;

export type StripeOutcome = keyof typeof OUTCOMES;

export function stripeOutcomeOf(value: unknown): StripeOutcome | null {
  return typeof value === "string" && value in OUTCOMES ? (value as StripeOutcome) : null;
}

function statusText(store: CreatorStore): { done: boolean; text: string } {
  if (store.stripeChargesEnabled && !store.stripe.payoutsEnabled) return { done: true, text: "Connected. You can take payments; finish your Stripe details to get payouts." };
  if (store.stripeChargesEnabled) return { done: true, text: "Connected. You can take payments." };
  if (store.stripe.connected) return { done: false, text: "Connected, but Stripe needs more details before you can take payments." };
  return { done: false, text: "Not connected yet." };
}

export function StripeStatus({
  store,
  returnTo,
  continueHref,
  outcome,
}: {
  store: CreatorStore;
  returnTo: "settings" | "setup";
  continueHref?: string;
  outcome: StripeOutcome | null;
}) {
  const status = statusText(store);
  const needsAction = store.stripe.connected && !store.stripeChargesEnabled;
  const shown = outcome ? OUTCOMES[outcome] : null;

  return (
    <div className="flex flex-col gap-3">
      {shown && (
        <Alert variant={shown.variant}>
          <AlertTitle>{shown.title}</AlertTitle>
          <AlertDescription>{shown.text}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-4 rounded-md border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-3">
          {status.done ? (
            <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 fill-mint text-surface" />
          ) : needsAction ? (
            <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-warning" />
          ) : (
            <CircleDashed aria-hidden="true" className="size-5 shrink-0 text-mute" />
          )}
          <span className="flex flex-col">
            <span className="font-semibold">Stripe</span>
            <span className="text-sm text-mute">{status.text}</span>
            {needsAction && (
              <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="text-sm text-blue underline-offset-4 hover:underline">
                Open your Stripe Dashboard
              </a>
            )}
          </span>
        </p>
        <StripeConnectButtons
          connected={store.stripe.connected}
          connectAvailable={connectAvailable()}
          testAvailable={testSellerAccountId() !== null}
          returnTo={returnTo}
          continueHref={continueHref}
        />
      </div>
    </div>
  );
}
