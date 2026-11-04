"use client";

import { Minus, Package, Plus } from "lucide-react";
import { useId, useState } from "react";

import { Frame } from "@/components/landing/ui";
import { PriceTag } from "@/components/store/price-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cleanStallName } from "@/lib/landing/demo";
import { formatMoney } from "@/lib/products/money";

// Product management (D-039): a cut-down product editor whose live preview updates as you type,
// like the real editor. Client-side only; text is cleaned and capped, money is integer cents.

const STEP_CENTS = 100;
const MIN_CENTS = 100;
const MAX_CENTS = 20_000;

export function ProductShowcase() {
  const titleId = useId();
  const buttonId = useId();
  const priceId = useId();
  const [title, setTitle] = useState("Freelancer budget workbook");
  const [buttonText, setButtonText] = useState("Get the workbook");
  const [discountOn, setDiscountOn] = useState(true);
  const discountId = useId();
  const [cents, setCents] = useState(1900);
  const [live, setLive] = useState(true);

  // The example discount is 30% off, rounded to a whole dollar and never below $1.
  const product = { priceCents: cents, salePriceCents: discountOn ? Math.max(100, Math.round((cents * 0.7) / 100) * 100) : null };
  const step = (delta: number) => setCents((value) => Math.min(MAX_CENTS, Math.max(MIN_CENTS, value + delta)));

  return (
    <Frame address="Dashboard / Products / Edit" bodyClassName="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5 border-b border-line p-5 sm:p-7 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-display text-h3">
            <Package aria-hidden="true" className="size-5 text-blue" />
            Edit product
          </p>
          <Label className="min-h-11 cursor-pointer gap-2 text-sm">
            <Switch checked={live} onCheckedChange={setLive} />
            {live ? "Published" : "Draft"}
          </Label>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={titleId}>Title</Label>
          <Input id={titleId} value={title} maxLength={30} autoComplete="off" onChange={(event) => setTitle(cleanStallName(event.target.value))} />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Pricing</legend>
          <div className="mt-2 flex items-center gap-3">
            <span id={priceId} className="text-sm text-mute">
              Price
            </span>
            <div className="ml-auto flex items-center gap-1 rounded-md border border-input bg-surface p-1" role="group" aria-labelledby={priceId}>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Lower price" onClick={() => step(-STEP_CENTS)}>
                <Minus aria-hidden="true" className="size-4" />
              </Button>
              <output aria-live="polite" className="w-20 text-center font-display text-money-m tabular-nums">
                {formatMoney(cents, "usd")}
              </output>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Raise price" onClick={() => step(STEP_CENTS)}>
                <Plus aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <label htmlFor={discountId} className="text-sm text-mute">
              Add a discount
            </label>
            <Switch id={discountId} checked={discountOn} onCheckedChange={setDiscountOn} />
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor={buttonId}>Button text</Label>
          <Input id={buttonId} value={buttonText} maxLength={24} autoComplete="off" onChange={(event) => setButtonText(cleanStallName(event.target.value).slice(0, 24))} />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 bg-bg-subtle p-5 sm:p-7">
        <p className="self-start text-sm font-semibold text-mute">Live preview</p>
        <div aria-hidden="true" className="flex w-full max-w-xs flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <div className="flex aspect-[16/9] items-end rounded-md bg-blue-soft p-3">
            <span className="rounded-sm bg-surface px-2 py-1 text-xs font-semibold">PDF workbook</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 font-semibold break-words">{title.trim() || "Untitled product"}</p>
            <PriceTag product={product} currency="usd" className="shrink-0 justify-end font-display text-money-m" regularClassName="text-mute" />
          </div>
          <span className="rounded-md bg-blue py-2.5 text-center text-sm font-semibold text-on-blue">{buttonText.trim() || "Buy now"}</span>
        </div>
        <p className="flex items-center gap-2 text-sm" aria-live="polite">
          {live ? <Badge variant="live">Live on your store</Badge> : <Badge variant="draft">Draft, only you can see it</Badge>}
        </p>
      </div>
    </Frame>
  );
}
