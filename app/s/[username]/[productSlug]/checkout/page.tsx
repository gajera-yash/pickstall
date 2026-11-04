import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CheckoutForm } from "@/components/store/checkout-form";
import { OrderSummary } from "@/components/store/order-summary";
import { StoreFrame, cardStyle, resolveTheme } from "@/components/store/store-theme";
import { APP_NAME } from "@/lib/config";
import { canBuy, loadCheckoutContext } from "@/lib/orders/queries";
import { payableCents } from "@/lib/products/pricing";

// Checkout page at /@username/product/checkout (rewrite in next.config.ts). Only published products
// of published stores reach it; the price shown here is information, the server recomputes it.
// Layout (D-069): the order summary first on a phone, on the right (staying in view) on wide pages.
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
    <StoreFrame theme={theme} wide>
      <div className="flex w-full max-w-xl flex-col gap-6 @3xl:max-w-5xl">
        <Link href={`/@${store.slug}/${product.slug}`} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold" style={{ color: preset.muted }}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          {product.title}
        </Link>

        <div className="grid w-full gap-6 @3xl:grid-cols-[minmax(0,1fr)_360px] @3xl:items-start @3xl:gap-8">
          <aside className="p-5 @3xl:sticky @3xl:top-8 @3xl:col-start-2 @3xl:row-start-1" style={cardStyle(theme)}>
            <OrderSummary product={product} storeName={store.name} currency={store.currency} theme={theme} />
          </aside>

          <section aria-labelledby="checkout-title" className="flex flex-col gap-5 p-5 @3xl:col-start-1 @3xl:row-start-1 @3xl:p-8" style={cardStyle(theme)}>
            <div className="flex flex-col gap-1">
              <h1 id="checkout-title" className="font-display text-h2 break-words" style={{ fontWeight: preset.displayWeight }}>
                {product.checkout.headline || "Checkout"}
              </h1>
              <p className="text-sm" style={{ color: preset.muted }}>
                Your details. Your receipt and access link go to your email.
              </p>
            </div>

            {available ? (
              // The form keeps the app's own field colors, so inputs stay readable on every theme.
              <div className="rounded-md bg-surface p-4 text-ink @3xl:p-6">
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

            <p className="flex items-center gap-2 text-xs" style={{ color: preset.muted }}>
              <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
              Sold by {store.name}. Payments are handled securely by the payment provider.
            </p>
          </section>
        </div>
      </div>
    </StoreFrame>
  );
}
