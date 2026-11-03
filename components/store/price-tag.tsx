import type { CSSProperties } from "react";

import { priceLabel, regularPriceLabel, type Priced } from "@/lib/products/pricing";
import { cn } from "@/lib/utils";

/**
 * A product's price (D-047): the price buyers pay, and with a discount the regular price struck
 * through next to it. Screen readers hear "was $29.00" instead of a bare struck number. Colors come
 * from the caller, so it fits both the app and a creator's themed store page.
 */
export function PriceTag({
  product,
  currency,
  className,
  regularClassName,
  regularStyle,
}: {
  product: Priced;
  currency: string;
  className?: string;
  regularClassName?: string;
  regularStyle?: CSSProperties;
}) {
  const regular = regularPriceLabel(product, currency);
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 tabular-nums", className)}>
      <span>{priceLabel(product, currency)}</span>
      {regular && (
        <del className={cn("text-[0.75em] font-medium decoration-2", regularClassName)} style={regularStyle}>
          <span className="sr-only">was </span>
          {regular}
        </del>
      )}
    </span>
  );
}
