import "server-only";

import { CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react";

import { PayPalConnect } from "@/components/dashboard/paypal-connect";
import { StripeStatus, type StripeOutcome } from "@/components/dashboard/stripe-status";
import type { CreatorStore } from "@/lib/auth/guards";
import { activeProvider, paypalConnectAvailable, paypalMode } from "@/lib/payments/paypal-config";
import { paypalSupportsCurrency } from "@/lib/payments/paypal-money";

/** The active provider's name for page copy ("PayPal" by default, D-118). */
export function providerLabel(): "PayPal" | "Stripe" {
  return activeProvider() === "stripe" ? "Stripe" : "PayPal";
}

/** True while payments run in test mode (PayPal sandbox; Stripe is checked by its own badge). */
export function paypalSandbox(): boolean {
  return paypalMode() === "sandbox";
}

/**
 * The payment-connection row shared by Settings > Payments and the setup wizard: PayPal (D-118), or
 * Stripe when PAYMENT_PROVIDER=stripe turns the dormant Stripe code back on.
 */
export function PaymentsConnection({
  store,
  returnTo,
  continueHref,
  stripeOutcome,
}: {
  store: CreatorStore;
  returnTo: "settings" | "setup";
  continueHref?: string;
  stripeOutcome: StripeOutcome | null;
}) {
  if (activeProvider() === "stripe") return <StripeStatus store={store} returnTo={returnTo} continueHref={continueHref} outcome={stripeOutcome} />;

  const mode = paypalMode();
  const modeLabel = mode === "sandbox" ? "Sandbox" : "Live";
  const available = paypalConnectAvailable();
  // An app saved in the other mode (a sandbox app after the server went live) cannot take payments.
  const wrongMode = store.paypal.connected && store.paypal.mode !== mode;
  const currencyOk = paypalSupportsCurrency(store.currency);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <p className="flex items-center gap-3">
        {store.chargesEnabled ? (
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 fill-mint text-surface" />
        ) : wrongMode || (store.paypal.connected && !currencyOk) ? (
          <TriangleAlert aria-hidden="true" className="size-5 shrink-0 text-warning" />
        ) : (
          <CircleDashed aria-hidden="true" className="size-5 shrink-0 text-mute" />
        )}
        <span className="flex flex-col">
          <span className="font-semibold">PayPal</span>
          <span className="text-sm text-mute">
            {store.chargesEnabled
              ? "Connected. You can take payments."
              : !currencyOk
                ? `PayPal doesn't take ${store.currency.toUpperCase()}. Change your store currency in Settings to take payments.`
                : wrongMode
                ? `Your saved app is a ${store.paypal.mode === "sandbox" ? "Sandbox" : "Live"} app. Connect a ${modeLabel} app to take payments.`
                : "Not connected yet."}
          </span>
        </span>
      </p>
      {available ? (
        <PayPalConnect connected={store.paypal.connected} modeLabel={modeLabel} clientIdEnd={store.paypal.clientIdEnd} continueHref={continueHref} />
      ) : (
        <p className="text-sm text-mute">Connecting PayPal isn&apos;t switched on for this server yet. It turns on once PayPal is configured.</p>
      )}
    </div>
  );
}
