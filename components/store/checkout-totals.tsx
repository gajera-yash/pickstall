"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { formatMoney } from "@/lib/products/money";

// What the buyer picked at checkout that changes the total (D-090): an applied coupon and a ticked
// order bump. The order summary shows it; the server still computes the real amount itself.

type AppliedCoupon = { code: string; discountCents: number; totalCents: number };

type Totals = {
  coupon: AppliedCoupon | null;
  setCoupon: (coupon: AppliedCoupon | null) => void;
  bump: boolean;
  setBump: (on: boolean) => void;
};

const TotalsContext = createContext<Totals | null>(null);

export function CheckoutTotalsProvider({ children }: { children: ReactNode }) {
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [bump, setBump] = useState(false);
  const value = useMemo(() => ({ coupon, setCoupon, bump, setBump }), [coupon, bump]);
  return <TotalsContext.Provider value={value}>{children}</TotalsContext.Provider>;
}

/** The shared checkout totals, or null outside the provider (then nothing is shown or updated). */
export function useCheckoutTotals(): Totals | null {
  return useContext(TotalsContext);
}

/** The total the summary shows: the coupon's total (or the product's) plus a ticked bump. */
export function summaryTotalCents(baseTotalCents: number, coupon: { totalCents: number } | null, bumpCents: number | null): number {
  return (coupon ? coupon.totalCents : baseTotalCents) + (bumpCents ?? 0);
}

/**
 * The order summary's coupon and bump lines and its total, kept in step with the form. Without a
 * coupon or bump it is just the product's total. Shows a full breakdown: subtotal, discount,
 * coupon, bump, platform fee note, tax note, and total.
 */
export function SummaryTotal({
  baseTotalCents,
  subtotalCents,
  currency,
  bump,
  mutedColor,
  lineColor,
}: {
  baseTotalCents: number;
  subtotalCents: number;
  currency: string;
  bump: { title: string; priceCents: number } | null;
  mutedColor: string;
  lineColor: string;
}) {
  const totals = useCheckoutTotals();
  const coupon = totals?.coupon ?? null;
  const withBump = Boolean(bump && totals?.bump);
  const total = summaryTotalCents(baseTotalCents, coupon, withBump && bump ? bump.priceCents : null);
  const money = (cents: number) => (cents === 0 ? "Free" : formatMoney(cents, currency));
  const isFree = total === 0;

  // Discount = subtotal - base (sale price diff)
  const saleDiff = subtotalCents - baseTotalCents;
  const hasDiscount = saleDiff > 0;

  return (
    <>
      {/* Subtotal */}
      <div className="flex justify-between gap-3">
        <dt style={{ color: mutedColor }}>Subtotal</dt>
        <dd>{formatMoney(subtotalCents, currency)}</dd>
      </div>

      {/* Sale discount */}
      {hasDiscount && (
        <div className="flex justify-between gap-3">
          <dt style={{ color: mutedColor }}>Discount</dt>
          <dd className="text-green-600 dark:text-green-400">−{formatMoney(saleDiff, currency)}</dd>
        </div>
      )}

      {/* Coupon code */}
      {coupon && (
        <div className="flex justify-between gap-3">
          <dt style={{ color: mutedColor }}>
            Code <span className="font-mono font-semibold">{coupon.code}</span>
          </dt>
          <dd className="text-green-600 dark:text-green-400">−{formatMoney(coupon.discountCents, currency)}</dd>
        </div>
      )}

      {/* Order bump */}
      {withBump && bump && (
        <div className="flex justify-between gap-3">
          <dt className="min-w-0 break-words" style={{ color: mutedColor }}>
            {bump.title}
          </dt>
          <dd>+{formatMoney(bump.priceCents, currency)}</dd>
        </div>
      )}

      {/* Platform fee */}
      <div className="flex justify-between gap-3">
        <dt style={{ color: mutedColor }}>Platform fee</dt>
        <dd className="font-medium text-emerald-600 dark:text-emerald-400">{formatMoney(0, currency)}</dd>
      </div>

      {/* Estimated tax */}
      <div className="flex justify-between gap-3">
        <dt style={{ color: mutedColor }}>Estimated tax</dt>
        <dd style={{ color: mutedColor }}>{formatMoney(0, currency)}</dd>
      </div>

      {/* Total */}
      <div className="flex items-baseline justify-between gap-3 border-t pt-3" style={{ borderColor: lineColor }}>
        <dt className="font-semibold">Total</dt>
        <dd className="font-display text-money-m" aria-live="polite">
          {isFree ? "Free" : money(total)}
        </dd>
      </div>
    </>
  );
}
