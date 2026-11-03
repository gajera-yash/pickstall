"use client";

import { useId, useState } from "react";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { PLANNED_PRICE_CENTS } from "@/lib/config";
import { CALCULATOR, compareFees, formatWholeDollars, snapSales } from "@/lib/landing/demo";

/** Monthly sales slider: what an assumed 10% per-sale cut would take, against Pickstall's $0. */
export function FeeCalculator() {
  const sliderId = useId();
  const [salesCents, setSalesCents] = useState<number>(CALCULATOR.defaultCents);
  const { cutCents, yearlyCutCents } = compareFees(salesCents);
  // The bar is the cut relative to the cut at the top of the slider.
  const cutScale = Math.min(1, Math.max(0.04, cutCents / compareFees(CALCULATOR.maxCents).cutCents));

  return (
    <div className="flex flex-col gap-6 rounded-lg border-2 border-border-strong bg-surface p-5 shadow-hard-md sm:p-7 lg:shadow-hard-lg">
      <div className="flex flex-col gap-3">
        <Label id={sliderId} className="text-sm">
          Your monthly sales
        </Label>
        <output className="font-display text-display-l tabular-nums">
          {formatWholeDollars(salesCents)}
        </output>
        <Slider
          min={CALCULATOR.minCents}
          max={CALCULATOR.maxCents}
          step={CALCULATOR.stepCents}
          value={[salesCents]}
          onValueChange={([next]) => next !== undefined && setSalesCents(snapSales(next))}
          thumb={{ "aria-labelledby": sliderId, "aria-valuetext": `${formatWholeDollars(salesCents)} a month` }}
        />
        <div className="flex justify-between text-xs text-mute tabular-nums">
          <span>{formatWholeDollars(CALCULATOR.minCents)}</span>
          <span>{formatWholeDollars(CALCULATOR.maxCents)}</span>
        </div>
      </div>

      <dl className="flex flex-col gap-4" aria-live="polite">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-mute">A 10% cut per sale takes</dt>
            <dd className="font-display text-money-m text-danger tabular-nums">{formatWholeDollars(cutCents)}/mo</dd>
          </div>
          <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-bg-subtle">
            <div
              className="h-full origin-left rounded-full bg-danger transition-transform duration-(--dur-base) ease-(--ease-out)"
              style={{ transform: `scaleX(${cutScale})` }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-mute">Pickstall platform fee</dt>
            <dd className="font-display text-money-m text-mint tabular-nums">$0/mo</dd>
          </div>
          <div aria-hidden="true" className="h-3 rounded-full bg-bg-subtle" />
        </div>
        <div className="flex items-baseline justify-between gap-3 rounded-md bg-mint-soft px-4 py-3">
          <dt className="text-sm font-semibold text-ink">You keep an extra</dt>
          <dd className="font-display text-money-l text-mint tabular-nums">{formatWholeDollars(yearlyCutCents)}/yr</dd>
        </div>
      </dl>

      <p className="text-xs text-mute">
        10% is an assumed example rate, not a quote for any platform. Stripe&apos;s card processing fees apply on top in both cases. Pickstall
        plans are planned at a flat {formatWholeDollars(PLANNED_PRICE_CENTS.starter)} or {formatWholeDollars(PLANNED_PRICE_CENTS.pro)} a month.
      </p>
    </div>
  );
}
