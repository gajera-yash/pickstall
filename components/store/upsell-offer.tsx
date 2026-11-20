"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { startUpsellCheckout, type UpsellState } from "@/lib/upsells/actions";
import type { OfferKind } from "@/lib/upsells/rules";

/** One offer as the thank-you page shows it (prices already formatted on the server). */
export type OfferView = { title: string; headline: string | null; price: string; regular: string | null };

type Props = {
  username: string;
  productSlug: string;
  orderId: string;
  title: string;
  headline: string | null;
  price: string;
  regular: string | null;
  accent: string;
  onAccent: string;
  muted: string;
  radius: number;
  /** Which offer this is (D-115): the downsell shows after "No thanks" on the upsell. */
  kind?: OfferKind;
  /** Called on "No thanks"; without it the offer just hides. */
  onDecline?: () => void;
};

/** The upsell, then the downsell (D-115) when the buyer declines it. */
export function PostPurchaseOffers({ upsell, downsell, ...shared }: Omit<Props, "kind" | "onDecline" | keyof OfferView> & { upsell: OfferView | null; downsell: OfferView | null }) {
  const [step, setStep] = useState<OfferKind | "done">(upsell ? "upsell" : downsell ? "downsell" : "done");
  if (step === "upsell" && upsell) return <UpsellOffer key="upsell" {...shared} {...upsell} kind="upsell" onDecline={() => setStep(downsell ? "downsell" : "done")} />;
  if (step === "downsell" && downsell) return <UpsellOffer key="downsell" {...shared} {...downsell} kind="downsell" onDecline={() => setStep("done")} />;
  return null;
}

/**
 * The upsell on the thank-you page (D-099): one product at a special price. "Yes, add it" asks the
 * server, which checks the offer again and takes the price from the database, then opens checkout.
 * "No thanks" just hides it.
 */
export function UpsellOffer({ username, productSlug, orderId, title, headline, price, regular, accent, onAccent, muted, radius, kind = "upsell", onDecline }: Props) {
  const [hidden, setHidden] = useState(false);
  const [state, action, pending] = useActionState<UpsellState>(() => startUpsellCheckout(username, productSlug, orderId, kind), null);
  if (hidden) return null;
  const error = state && !state.ok ? state.error : null;

  return (
    <section aria-labelledby="upsell-title" className="flex flex-col gap-3 rounded-md border-2 border-dashed p-4" style={{ borderColor: accent }}>
      <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: accent }}>
        <Sparkles aria-hidden="true" className="size-4" />
        {kind === "downsell" ? "Another option" : "One-time offer"}
      </p>
      <h2 id="upsell-title" className="font-display text-h4 break-words">
        {headline || `Add ${title}`}
      </h2>
      <p className="text-sm break-words" style={{ color: muted }}>
        {title}:{" "}
        <span className="font-semibold" style={{ color: "inherit" }}>
          {price}
        </span>
        {regular && regular !== price && (
          <>
            {" "}
            <s>{regular}</s>
          </>
        )}
        . Only available right now.
      </p>
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form action={action} className="flex flex-col gap-2">
        <Button type="submit" size="lg" className="w-full" loading={pending} style={{ background: accent, color: onAccent, borderRadius: radius }}>
          Yes, add it
        </Button>
        <button type="button" className="min-h-11 text-sm underline underline-offset-4" style={{ color: muted }} onClick={() => (onDecline ? onDecline() : setHidden(true))}>
          No thanks
        </button>
      </form>
    </section>
  );
}
