"use client";

import { ShoppingCart } from "lucide-react";
import { useState, useTransition } from "react";

import { Field, MoneyInput } from "@/components/dashboard/editor-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAutoHide } from "@/components/ui/use-auto-hide";
import { saveBumpAction } from "@/lib/bumps/actions";
import { BUMP_HEADLINE_MAX } from "@/lib/bumps/rules";

export type BumpSettings = { enabled: boolean; productId: string; price: string; headline: string };
export type BumpCandidate = { id: string; title: string; status: "draft" | "published" | "archived" };

/**
 * Order bump settings for one product (D-089): offer one other digital product or course at
 * checkout with a tick, at its own price. Saves on its own, apart from the editor's form.
 */
export function BumpSection({ productId, currency, initial, candidates }: { productId: string; currency: string; initial: BumpSettings; candidates: BumpCandidate[] }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<{ text: string; field?: string } | null>(null);
  const [saved, setSaved] = useState<object | null>(null);
  const showSaved = useAutoHide(saved);
  const set = <K extends keyof BumpSettings>(key: K, value: BumpSettings[K]) => setValues((current) => ({ ...current, [key]: value }));
  const fieldError = (field: string) => (problem?.field === field ? problem.text : null);
  const chosen = candidates.find((candidate) => candidate.id === values.productId);

  const save = () => {
    setProblem(null);
    startTransition(async () => {
      const result = await saveBumpAction(productId, values);
      if (!result.ok) {
        setProblem({ text: result.error, field: result.field });
        return;
      }
      setSaved({});
    });
  };

  return (
    <section aria-labelledby={`bump-${productId}`} className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 id={`bump-${productId}`} className="flex items-center gap-2 font-display text-h4">
            <ShoppingCart aria-hidden="true" className="size-4 text-blue" />
            Order bump
          </h3>
          <p className="text-sm text-mute">Offer one more product at checkout. Buyers add it with a single tick and pay once.</p>
        </div>
        <Switch checked={values.enabled} onCheckedChange={(checked) => set("enabled", checked)} aria-label="Offer an order bump" />
      </div>

      {values.enabled &&
        (candidates.length === 0 ? (
          <p className="text-sm text-mute">Create another digital product or course first; it can then be offered here.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field id={`bump-product-${productId}`} label="Product to offer" error={fieldError("productId")} hint={chosen?.status === "draft" ? "This product is a draft: buyers see the offer once you publish it." : undefined}>
              <NativeSelect id={`bump-product-${productId}`} value={values.productId} onChange={(event) => set("productId", event.target.value)} aria-invalid={!!fieldError("productId")}>
                <NativeSelectOption value="">Pick a product</NativeSelectOption>
                {candidates.map((candidate) => (
                  <NativeSelectOption key={candidate.id} value={candidate.id}>
                    {candidate.title}
                    {candidate.status === "draft" ? " (draft)" : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field id={`bump-price-${productId}`} label="Offer price" error={fieldError("price")} hint="Usually a little lower than its normal price.">
              <MoneyInput id={`bump-price-${productId}`} currency={currency} value={values.price} onChange={(value) => set("price", value)} invalid={!!fieldError("price")} />
            </Field>
            <Field id={`bump-headline-${productId}`} label="Headline (optional)" hint={`${values.headline.length}/${BUMP_HEADLINE_MAX}`}>
              <Input id={`bump-headline-${productId}`} value={values.headline} maxLength={BUMP_HEADLINE_MAX} onChange={(event) => set("headline", event.target.value)} placeholder="Add the workbook and get twice the results" />
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
          Save order bump
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
