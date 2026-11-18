"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";

import { useCheckoutTotals } from "@/components/store/checkout-totals";
import { Checkbox } from "@/components/ui/checkbox";
import { safeImageSrc } from "@/lib/media/media";

export type BumpOfferData = { title: string; coverUrl: string | null; price: string; headline: string | null };

/**
 * The order bump at checkout (D-089): one tick adds another product at its offer price. The form
 * sends `addBump`; the server takes the product and its price from the database.
 */
export function BumpOffer({ bump }: { bump: BumpOfferData }) {
  const [checked, setChecked] = useState(false);
  const totals = useCheckoutTotals();
  const cover = safeImageSrc(bump.coverUrl);
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-dashed border-line bg-bg-subtle p-4 has-data-[state=checked]:bg-blue-soft">
      <Checkbox checked={checked} onCheckedChange={(next) => (setChecked(next === true), totals?.setBump(next === true))} className="mt-1" aria-describedby="bump-offer-text" />
      {checked && <input type="hidden" name="addBump" value="on" />}
      <span className="flex min-w-0 flex-1 gap-3">
        {cover ? (
          // A creator's own https image on any host, so next/image (fixed remote hosts) cannot load it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" referrerPolicy="no-referrer" className="size-12 shrink-0 rounded-md object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-md bg-surface text-mute">
            <ImageIcon className="size-5" />
          </span>
        )}
        <span id="bump-offer-text" className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold break-words">
            Yes, add {bump.title} for {bump.price}
          </span>
          {bump.headline && <span className="text-sm break-words text-mute">{bump.headline}</span>}
        </span>
      </span>
    </label>
  );
}
