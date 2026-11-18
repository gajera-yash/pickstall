"use client";

import { Tag, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCheckoutTotals } from "@/components/store/checkout-totals";
import { previewCoupon, type CouponPreview } from "@/lib/coupons/actions";

/**
 * "Have a discount code?" at checkout (D-088). Apply checks the code on the server and shows the new
 * total; the applied code goes with the form as `couponCode`, and the server checks it again and
 * computes the amount itself when the order starts.
 */
export function CouponField({ username, productSlug, serverError }: { username: string; productSlug: string; serverError: string | null }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<CouponPreview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const totals = useCheckoutTotals();

  const apply = () => {
    setProblem(null);
    startTransition(async () => {
      const result = await previewCoupon(username, productSlug, code);
      if (!result.ok) {
        setProblem(result.error);
        setApplied(null);
        totals?.setCoupon(null);
        return;
      }
      setApplied(result.data);
      totals?.setCoupon({ code: result.data.code, discountCents: result.data.discountCents, totalCents: result.data.totalCents });
    });
  };

  const error = problem ?? serverError;

  if (applied) {
    return (
      <div className="flex flex-col gap-2">
        <input type="hidden" name="couponCode" value={applied.code} />
        <div className="flex items-center gap-3 rounded-lg border border-line bg-bg-subtle px-3 py-2.5 text-sm">
          <Tag aria-hidden="true" className="size-4 shrink-0 text-mint" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold">
              {applied.code} · {applied.label}
            </span>
            <span className="text-mute">
              {/* The order summary shows the new total, with an order bump if ticked (D-090). */}
              You save {applied.discount}.
            </span>
          </span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => (setApplied(null), setCode(""), totals?.setCoupon(null))} aria-label={`Remove code ${applied.code}`}>
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
        {serverError && <FieldError id="couponCode-error">{serverError}</FieldError>}
      </div>
    );
  }

  if (!open && !serverError) {
    return (
      <Button type="button" variant="link" className="h-auto self-start text-sm" onClick={() => setOpen(true)}>
        Have a discount code?
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="couponCode" className="text-sm font-semibold">
        Discount code
      </label>
      <div className="flex gap-2">
        <Input
          id="couponCode"
          value={code}
          maxLength={20}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            // Enter applies the code instead of submitting the whole checkout.
            if (event.key === "Enter") {
              event.preventDefault();
              if (code.trim()) apply();
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "couponCode-error" : undefined}
          placeholder="SAVE20"
          className="uppercase"
        />
        <Button type="button" variant="secondary" onClick={apply} loading={pending} disabled={!code.trim()}>
          Apply
        </Button>
      </div>
      {error && <FieldError id="couponCode-error">{error}</FieldError>}
    </div>
  );
}
