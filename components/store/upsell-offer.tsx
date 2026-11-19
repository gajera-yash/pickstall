"use client";

import { Sparkles } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { startUpsellCheckout, type UpsellState } from "@/lib/upsells/actions";

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
};

/**
 * The upsell on the thank-you page (D-099): one product at a special price. "Yes, add it" asks the
 * server, which checks the offer again and takes the price from the database, then opens checkout.
 * "No thanks" just hides it.
 */
export function UpsellOffer({ username, productSlug, orderId, title, headline, price, regular, accent, onAccent, muted, radius }: Props) {
  const [hidden, setHidden] = useState(false);
  const [state, action, pending] = useActionState<UpsellState>(() => startUpsellCheckout(username, productSlug, orderId), null);
  if (hidden) return null;
  const error = state && !state.ok ? state.error : null;

  return (
    <section aria-labelledby="upsell-title" className="flex flex-col gap-3 rounded-md border-2 border-dashed p-4" style={{ borderColor: accent }}>
      <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: accent }}>
        <Sparkles aria-hidden="true" className="size-4" />
        One-time offer
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
        <button type="button" className="min-h-11 text-sm underline underline-offset-4" style={{ color: muted }} onClick={() => setHidden(true)}>
          No thanks
        </button>
      </form>
    </section>
  );
}
