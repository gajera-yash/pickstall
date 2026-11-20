"use client";

import { Sparkles } from "lucide-react";
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
import { UPSELL_HEADLINE_MAX } from "@/lib/upsells/rules";


export type UpsellSettings = { enabled: boolean; productId: string; price: string; headline: string };

/**
 * Upsell settings for one product (D-099): after a paid order, the thank-you page offers one other
 * digital product or course at this price. Saves on its own, apart from the editor's form. Pro;
 * `locked` shows it off with an upgrade link.
 */
export function UpsellSection({ productId, currency, initial, candidates, locked = false }: { productId: string; currency: string; initial: UpsellSettings; candidates: BumpCandidate[]; locked?: boolean }) {
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
      const result = await saveUpsellAction(productId, { ...values, enabled: values.enabled && !locked });
      if (!result.ok) {
        setProblem({ text: result.error, field: result.field });
        return;
      }
      setSaved({});
    });
  };

  return (
    <section aria-labelledby={`upsell-${productId}`} className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 id={`upsell-${productId}`} className="flex items-center gap-2 font-display text-h4">
            <Sparkles aria-hidden="true" className="size-4 text-blue" />
            Upsell after purchase
          </h3>
          <p className="text-sm text-mute">Right after someone buys, their thank-you page offers one more product at a special price for two hours.</p>
        </div>
        <Switch checked={values.enabled && !locked} disabled={locked} onCheckedChange={(checked) => set("enabled", checked)} aria-label="Offer an upsell after purchase" />
      </div>
      <HowItWorks content={UPSELL_HOW_IT_WORKS} title="How does an upsell work?" />
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
            <Field id={`upsell-product-${productId}`} label="Product to offer" error={fieldError("productId")} hint={chosen?.status === "draft" ? "This product is a draft: buyers see the offer once you publish it." : undefined}>
              <ChoiceSelect id={`upsell-product-${productId}`} value={values.productId} onValueChange={(value) => set("productId", value)} invalid={!!fieldError("productId")} placeholder="Pick a product" options={candidates.map((candidate) => ({ value: candidate.id, label: `${candidate.title}${candidate.status === "draft" ? " (draft)" : ""}` }))} />
            </Field>
            <Field id={`upsell-price-${productId}`} label="Offer price" error={fieldError("price")} hint="Usually lower than its normal price. 0 makes it a free gift.">
              <MoneyInput id={`upsell-price-${productId}`} currency={currency} value={values.price} onChange={(value) => set("price", value)} invalid={!!fieldError("price")} />
            </Field>
            <Field id={`upsell-headline-${productId}`} label="Headline (optional)" hint={`${values.headline.length}/${UPSELL_HEADLINE_MAX}`}>
              <Input id={`upsell-headline-${productId}`} value={values.headline} maxLength={UPSELL_HEADLINE_MAX} onChange={(event) => set("headline", event.target.value)} placeholder="Wait! Add the advanced course at a one-time price" />
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
          Save upsell
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
