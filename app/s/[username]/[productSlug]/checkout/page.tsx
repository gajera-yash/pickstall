import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CheckoutForm } from "@/components/store/checkout-form";
import { PriceTag } from "@/components/store/price-tag";
import { StoreFrame, cardStyle, resolveTheme } from "@/components/store/store-theme";
import { APP_NAME } from "@/lib/config";
import { canBuy, loadCheckoutContext } from "@/lib/orders/queries";
import { payableCents } from "@/lib/products/pricing";

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
          <PriceTag product={product} currency={store.currency} className="shrink-0 justify-end font-display text-money-m" regularStyle={{ color: preset.muted }} />
        </div>

        {available ? (
          <div className="rounded-md bg-surface p-4 text-ink">
            <CheckoutForm
              username={store.slug}
              productSlug={product.slug}
              askPhone={product.checkout.askPhone}
              questions={product.checkout.questions}
              submitLabel={payableCents(product) === 0 ? "Get it free" : product.buttonText || "Pay now"}
            />
          </div>
        ) : (
          <p style={{ color: preset.muted }}>This store can&apos;t take payments yet. Please check back soon.</p>
        )}
      </div>
    </StoreFrame>
  );
}
