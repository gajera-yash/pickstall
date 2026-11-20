"use client";

import { ArrowDownRight, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import type { BumpCandidate } from "@/components/dashboard/bump-section";
import { Field, MoneyInput } from "@/components/dashboard/editor-fields";
import { HowItWorks, UPSELL_HOW_IT_WORKS } from "@/components/dashboard/how-it-works";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { Switch } from "@/components/ui/switch";
import { useAutoHide } from "@/components/ui/use-auto-hide";
import { saveUpsellAction } from "@/lib/upsells/actions";
import { UPSELL_HEADLINE_MAX, type OfferKind } from "@/lib/upsells/rules";

export type UpsellSettings = { enabled: boolean; productId: string; price: string; headline: string };

/** What the editors get: the upsell, the downsell (D-115) and whether the plan includes them. */
export type AfterPurchaseSettings = { initial: UpsellSettings; downsell: UpsellSettings; locked: boolean };

const COPY: Record<OfferKind, { title: string; description: string; switchLabel: string; save: string; placeholder: string }> = {
  upsell: {
    title: "Upsell after purchase",
    description: "Right after someone buys, their thank-you page offers one more product at a special price for two hours.",
    switchLabel: "Offer an upsell after purchase",
    save: "Save upsell",
    placeholder: "Wait! Add the advanced course at a one-time price",
  },
  downsell: {
    title: "Downsell if they say no",
    description: "When the buyer clicks “No thanks” on the upsell, offer this instead: a smaller product, or the same one for less.",
    switchLabel: "Offer a downsell when the upsell is declined",
    save: "Save downsell",
    placeholder: "No problem! Get the starter version instead",
  },
};

/** The upsell and, under it, the downsell (D-115), for every product editor. */
export function AfterPurchaseOffers({ productId, currency, settings, candidates }: { productId: string; currency: string; settings: AfterPurchaseSettings; candidates: BumpCandidate[] }) {
  return (
    <>
      <UpsellSection productId={productId} currency={currency} initial={settings.initial} candidates={candidates} locked={settings.locked} />
      <UpsellSection productId={productId} currency={currency} initial={settings.downsell} candidates={candidates} locked={settings.locked} kind="downsell" />
    </>
  );
}

/**
 * Upsell settings for one product (D-099): after a paid order, the thank-you page offers one other
 * digital product or course at this price. Saves on its own, apart from the editor's form. Pro;
 * `locked` shows it off with an upgrade link.
 */
export function UpsellSection({
  productId,
  currency,
  initial,
  candidates,
  locked = false,
  kind = "upsell",
}: {
  productId: string;
  currency: string;
  initial: UpsellSettings;
  candidates: BumpCandidate[];
  locked?: boolean;
  kind?: OfferKind;
}) {
  const copy = COPY[kind];
  const Icon = kind === "upsell" ? Sparkles : ArrowDownRight;
  const key = `${kind}-${productId}`;
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<{ text: string; field?: string } | null>(null);
  const [saved, setSaved] = useState<object | null>(null);
  const showSaved = useAutoHide(saved);
  const set = <K extends keyof UpsellSettings>(key: K, value: UpsellSettings[K]) => setValues((current) => ({ ...current, [key]: value }));
  const fieldError = (field: string) => (problem?.field === field ? problem.text : null);
  const chosen = candidates.find((candidate) => candidate.id === values.productId);

  const save = () => {
    setProblem(null);
    startTransition(async () => {
      const result = await saveUpsellAction(productId, { ...values, enabled: values.enabled && !locked }, kind);
      if (!result.ok) {
        setProblem({ text: result.error, field: result.field });
        return;
      }
      setSaved({});
    });
  };

  return (
    <section aria-labelledby={key} className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 id={key} className="flex items-center gap-2 font-display text-h4">
            <Icon aria-hidden="true" className="size-4 text-blue" />
            {copy.title}
          </h3>
          <p className="text-sm text-mute">{copy.description}</p>
        </div>
        <Switch checked={values.enabled && !locked} disabled={locked} onCheckedChange={(checked) => set("enabled", checked)} aria-label={copy.switchLabel} />
      </div>
      {kind === "upsell" && <HowItWorks content={UPSELL_HOW_IT_WORKS} title="How does an upsell work?" />}
      {locked && (
        <p className="text-sm text-mute">
          Part of Pro.{" "}
          <a href="/dashboard/settings/plan" className="font-semibold text-blue underline underline-offset-4">
            Upgrade your plan
          </a>{" "}
          to turn it on.
        </p>
      )}

      {values.enabled && !locked &&
        (candidates.length === 0 ? (
          <p className="text-sm text-mute">Create another digital product or course first; it can then be offered here.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field id={`${key}-product`} label="Product to offer" error={fieldError("productId")} hint={chosen?.status === "draft" ? "This product is a draft: buyers see the offer once you publish it." : undefined}>
              <ChoiceSelect id={`${key}-product`} value={values.productId} onValueChange={(value) => set("productId", value)} invalid={!!fieldError("productId")} placeholder="Pick a product" options={candidates.map((candidate) => ({ value: candidate.id, label: `${candidate.title}${candidate.status === "draft" ? " (draft)" : ""}` }))} />
            </Field>
            <Field id={`${key}-price`} label="Offer price" error={fieldError("price")} hint="Usually lower than its normal price. 0 makes it a free gift.">
              <MoneyInput id={`${key}-price`} currency={currency} value={values.price} onChange={(value) => set("price", value)} invalid={!!fieldError("price")} />
            </Field>
            <Field id={`${key}-headline`} label="Headline (optional)" hint={`${values.headline.length}/${UPSELL_HEADLINE_MAX}`}>
              <Input id={`${key}-headline`} value={values.headline} maxLength={UPSELL_HEADLINE_MAX} onChange={(event) => set("headline", event.target.value)} placeholder={copy.placeholder} />
            </Field>
          </div>
        ))}

      {problem && !problem.field && (
        <Alert variant="error">
          <AlertDescription>{problem.text}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={save} loading={pending}>
          {copy.save}
        </Button>
        {showSaved && (
          <span role="status" className="text-sm text-mint">
            Saved
          </span>
        )}
      </div>
    </section>
  );
}
