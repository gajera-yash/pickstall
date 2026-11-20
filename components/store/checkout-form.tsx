"use client";

import { Lock } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { PhoneField } from "@/components/auth/phone-field";
import { BumpOffer, type BumpOfferData } from "@/components/store/bump-offer";
import { CouponField } from "@/components/store/coupon-field";
import { SlotPicker } from "@/components/store/slot-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import { FormField, describedBy } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { Textarea } from "@/components/ui/textarea";
import { ANSWER_MAX_CHARS, BUYER_NAME_MAX } from "@/lib/config";
import { startCheckout, type CheckoutState } from "@/lib/orders/actions";
import { VisitSourceFields } from "@/components/store/visit-source";

export type CheckoutQuestion = { id: string; label: string; kind: "text" | "long_text" | "dropdown" | "checkbox"; required: boolean; options: string[] };

type Props = {
  username: string;
  productSlug: string;
  askPhone: boolean;
  questions: CheckoutQuestion[];
  submitLabel: string;
  /** A coaching call (D-083): the open times from the slot engine and the call length. */
  booking?: { slots: { start: string; end: string }[]; durationMinutes: number } | null;
  /** Show "Have a discount code?" (D-088): only for a product that costs something. */
  coupons?: boolean;
  /** An order bump to offer (D-089). */
  bump?: BumpOfferData | null;
  /**
   * Email list consent (D-094): an unticked "Email me updates" box, or for a lead magnet a plain
   * notice that signing up includes emails. The server saves its own copy of the same words.
   */
  consent?: { kind: "checkbox" | "notice"; text: string } | null;
  /** Nothing to pay (a free product or lead magnet): no line about card details. */
  free?: boolean;
};

/**
 * Checkout form (PRD F4): a coaching call's time first (D-083), then name and email always, optional
 * phone and the creator's questions. Typed
 * values are kept after an error and focus moves to the first problem. The price is not on this
 * form at all: the server takes it from the product (D-047).
 */
export function CheckoutForm({ username, productSlug, askPhone, questions, submitLabel, booking, coupons = false, bump = null, consent = null, free = false }: Props) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(startCheckout.bind(null, username, productSlug), null);
  const error = state && !state.ok ? state : null;
  const fieldError = (field: string) => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;
  const [values, setValues] = useState<Record<string, string>>({});
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (error?.field) document.getElementById(error.field)?.focus();
  }, [error]);

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <VisitSourceFields />
      {formError && (
        <Alert variant="error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {booking && <SlotPicker slots={booking.slots} durationMinutes={booking.durationMinutes} error={fieldError("slotStart")} />}

      <FormField id="name" label="Your name" error={fieldError("name")}>
        <Input id="name" name="name" autoComplete="name" required maxLength={BUYER_NAME_MAX} value={values.name ?? ""} onChange={(event) => set("name", event.target.value)} aria-invalid={fieldError("name") ? true : undefined} aria-describedby={describedBy("name", fieldError("name"))} />
      </FormField>

      <FormField id="email" label="Email" error={fieldError("email")} hint={booking ? "Your booking and receipt go here." : "Your receipt and access link go here."}>
        <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={values.email ?? ""} onChange={(event) => set("email", event.target.value)} aria-invalid={fieldError("email") ? true : undefined} aria-describedby={describedBy("email", fieldError("email"), "hint")} />
      </FormField>

      {askPhone && <PhoneField error={fieldError("phone")} />}

      {questions.map((question) => {
        const field = `answer-${question.id}`;
        const problem = fieldError(field);
        const suffix = question.required ? "" : " (optional)";
        if (question.kind === "checkbox") {
          return (
            <div key={question.id} className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-start gap-3 text-sm font-medium">
                <Checkbox id={field} name={field} className="mt-0.5" checked={values[field] === "true"} onCheckedChange={(checked) => set(field, checked === true ? "true" : "false")} aria-invalid={problem ? true : undefined} />
                <span>
                  {question.label}
                  {suffix}
                </span>
              </label>
              {values[field] !== "true" && <input type="hidden" name={field} value="false" />}
              <FieldError>{problem}</FieldError>
            </div>
          );
        }
        return (
          <FormField key={question.id} id={field} label={`${question.label}${suffix}`} error={problem}>
            {question.kind === "long_text" ? (
              <Textarea id={field} name={field} rows={4} maxLength={ANSWER_MAX_CHARS.long_text} value={values[field] ?? ""} onChange={(event) => set(field, event.target.value)} aria-invalid={problem ? true : undefined} />
            ) : question.kind === "dropdown" ? (
              <ChoiceSelect id={field} name={field} value={values[field] ?? ""} onValueChange={(value) => set(field, value)} invalid={Boolean(problem)} placeholder="Choose..." options={question.options.map((option) => ({ value: option, label: option }))} />
            ) : (
              <Input id={field} name={field} maxLength={ANSWER_MAX_CHARS.text} value={values[field] ?? ""} onChange={(event) => set(field, event.target.value)} aria-invalid={problem ? true : undefined} />
            )}
          </FormField>
        );
      })}

      {bump && <BumpOffer bump={bump} />}

      {coupons && <CouponField username={username} productSlug={productSlug} serverError={fieldError("couponCode")} />}

      {consent?.kind === "checkbox" && (
        <div className="flex items-start gap-3">
          <Checkbox id="marketingConsent" name="marketingConsent" className="mt-0.5" />
          <label htmlFor="marketingConsent" className="text-sm text-mute">
            {consent.text}
          </label>
        </div>
      )}
      {consent?.kind === "notice" && <p className="text-sm text-mute">{consent.text}</p>}

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        <Lock aria-hidden="true" className="size-4" />
        {submitLabel}
      </Button>
      {!free && <p className="text-center text-sm text-mute">Card details are entered on the payment provider&apos;s secure page, never here.</p>}
      <p className="text-center text-xs text-mute">
        You buy from this creator. Pickstall&apos;s{" "}
        <a href="/terms" target="_blank" rel="noopener" className="underline underline-offset-4">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" target="_blank" rel="noopener" className="underline underline-offset-4">
          Privacy Policy
        </a>{" "}
        apply.
      </p>
    </form>
  );
}
