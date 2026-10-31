import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CheckoutForm } from "@/components/store/checkout-form";
import { priceLabel } from "@/components/store/store-page";
import { StoreFrame, cardStyle, resolveTheme } from "@/components/store/store-theme";
import { APP_NAME } from "@/lib/config";
import { canBuy, loadCheckoutContext } from "@/lib/orders/queries";
import { centsToInput, formatMoney } from "@/lib/products/money";

// Checkout page at /@username/product/checkout (rewrite in next.config.ts). Only published products
// of published stores reach it; the price shown here is information, the server recomputes it.
export const instant = false;
export const metadata: Metadata = { title: `Checkout | ${APP_NAME}`, robots: { index: false } };

export default async function CheckoutPage({ params }: PageProps<"/s/[username]/[productSlug]/checkout">) {
  const { username, productSlug } = await params;
  const context = await loadCheckoutContext(username, productSlug);
  if (!context) notFound();

  const { store, product } = context;
  const theme = resolveTheme(store.theme);
  const { preset } = theme;
  const pwyw = product.pricingModel === "pwyw";
  const minimum = pwyw ? (product.minPriceCents ?? 0) : 0;
  const available = canBuy(context);

  return (
    <StoreFrame theme={theme}>
      <Link href={`/@${store.slug}/${product.slug}`} className="inline-flex items-center gap-1 self-start text-sm font-semibold" style={{ color: preset.muted }}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        {product.title}
      </Link>

      <div className="flex w-full flex-col gap-5 p-5" style={cardStyle(theme)}>
        <h1 className="font-display text-h2 break-words" style={{ fontWeight: preset.displayWeight }}>
          {product.checkout.headline || "Checkout"}
        </h1>
        <div className="flex items-center justify-between gap-3 border-b pb-4" style={{ borderColor: preset.muted }}>
          <span className="min-w-0 break-words">{product.title}</span>
          <span className="shrink-0 font-display text-money-m tabular-nums">{priceLabel(product, store.currency)}</span>
        </div>

        {available ? (
          <div className="rounded-md bg-surface p-4 text-ink">
            <CheckoutForm
              username={store.slug}
              productSlug={product.slug}
              askPhone={product.checkout.askPhone}
              questions={product.checkout.questions}
              suggestedAmount={pwyw ? centsToInput(product.priceCents) : null}
              minimumLabel={pwyw ? (minimum > 0 ? `Minimum ${formatMoney(minimum, store.currency)}.` : "Any amount, including 0.") : null}
              submitLabel={product.priceCents === 0 && !pwyw ? "Get it free" : product.buttonText || "Pay now"}
            />
          </div>
        ) : (
          <p style={{ color: preset.muted }}>This store can&apos;t take payments yet. Please check back soon.</p>
        )}
      </div>
    </StoreFrame>
  );
}
