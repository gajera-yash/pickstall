"use client";

import { m } from "motion/react";
import { Minus, Package, Plus } from "lucide-react";
import { useId, useState } from "react";

import { Frame } from "@/components/landing/ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cleanStallName } from "@/lib/landing/demo";
import { formatMoney } from "@/lib/products/money";
import { cn } from "@/lib/utils";

// Product management (D-039): a cut-down product editor whose live preview updates as you type,
// like the real editor. Client-side only; text is cleaned and capped, money is integer cents.

const STEP_CENTS = 100;
const MIN_CENTS = 100;
const MAX_CENTS = 20_000;

type Model = "fixed" | "pwyw";

export function ProductShowcase() {
  const titleId = useId();
  const buttonId = useId();
  const priceId = useId();
  const [title, setTitle] = useState("Freelancer budget workbook");
  const [buttonText, setButtonText] = useState("Get the workbook");
  const [model, setModel] = useState<Model>("fixed");
  const [cents, setCents] = useState(1900);
  const [live, setLive] = useState(true);

  const priceLabel = model === "pwyw" ? `${formatMoney(cents, "usd")}+` : formatMoney(cents, "usd");
  const step = (delta: number) => setCents((value) => Math.min(MAX_CENTS, Math.max(MIN_CENTS, value + delta)));

  return (
    <Frame address="Dashboard / Products / Edit" bodyClassName="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5 border-b border-line p-5 sm:p-7 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-display text-h3">
            <Package aria-hidden="true" className="size-5 text-blue" />
            Edit product
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={live}
            onClick={() => setLive((value) => !value)}
            className="flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold"
          >
            <span className={cn("relative h-6 w-10 rounded-full border transition-colors duration-(--dur-fast)", live ? "border-mint bg-mint" : "border-input bg-bg-subtle")}>
              <m.span
                aria-hidden="true"
                className="absolute top-0.5 left-0.5 size-[1.125rem] rounded-full bg-surface shadow-popover"
                animate={{ x: live ? 16 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
              />
            </span>
            {live ? "Published" : "Draft"}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={titleId}>Title</Label>
          <Input id={titleId} value={title} maxLength={30} autoComplete="off" onChange={(event) => setTitle(cleanStallName(event.target.value))} />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Pricing</legend>
          <div role="radiogroup" aria-label="Price model" className="grid grid-cols-2 gap-1 rounded-md border border-line bg-bg-subtle p-1">
            {(
              [
                { id: "fixed", label: "Fixed price" },
                { id: "pwyw", label: "Pay what you want" },
              ] as const
            ).map((option) => {
              const on = model === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setModel(option.id)}
                  className={cn("relative min-h-10 rounded-sm px-2 text-sm font-semibold", on ? "text-ink" : "text-mute hover:text-ink")}
                >
                  {on && (
                    <m.span
                      layoutId="price-model"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-sm border border-line bg-surface"
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                  <span className="relative">{option.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span id={priceId} className="text-sm text-mute">
              {model === "pwyw" ? "Minimum" : "Price"}
            </span>
            <div className="ml-auto flex items-center gap-1 rounded-md border border-input bg-surface p-1" role="group" aria-labelledby={priceId}>
              <button type="button" aria-label="Lower price" onClick={() => step(-STEP_CENTS)} className="flex size-9 items-center justify-center rounded-sm hover:bg-bg-subtle">
                <Minus aria-hidden="true" className="size-4" />
              </button>
              <output aria-live="polite" className="w-20 text-center font-display text-money-m tabular-nums">
                {formatMoney(cents, "usd")}
              </output>
              <button type="button" aria-label="Raise price" onClick={() => step(STEP_CENTS)} className="flex size-9 items-center justify-center rounded-sm hover:bg-bg-subtle">
                <Plus aria-hidden="true" className="size-4" />
              </button>
            </div>
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
            <span className="shrink-0 font-display text-money-m tabular-nums">{priceLabel}</span>
          </div>
          {model === "pwyw" && <p className="text-xs text-mute">Pay what you want. Minimum {formatMoney(cents, "usd")}.</p>}
          <span className="rounded-md bg-blue py-2.5 text-center text-sm font-semibold text-on-blue">{buttonText.trim() || "Buy now"}</span>
        </div>
        <p className="flex items-center gap-2 text-sm" aria-live="polite">
          {live ? <Badge variant="live">Live on your store</Badge> : <Badge variant="draft">Draft, only you can see it</Badge>}
        </p>
      </div>
    </Frame>
  );
}
