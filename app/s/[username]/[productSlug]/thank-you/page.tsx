import { CheckCircle2, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StoreFrame, cardStyle, resolveTheme } from "@/components/store/store-theme";
import { APP_NAME } from "@/lib/config";
import { isUuid } from "@/lib/media/media";
import { findOrderForThankYou, loadCheckoutContext } from "@/lib/orders/queries";

export const instant = false;
export const metadata: Metadata = { title: `Thank you | ${APP_NAME}`, robots: { index: false } };

// Where buyers land after paying. It shows a message only; it never grants access (only the verified
// payment event does). The order id is an unguessable uuid and must belong to this store.
export default async function ThankYouPage({ params, searchParams }: PageProps<"/s/[username]/[productSlug]/thank-you">) {
  const [{ username, productSlug }, query] = await Promise.all([params, searchParams]);
  const orderId = typeof query.order === "string" ? query.order : "";
  const context = await loadCheckoutContext(username, productSlug);
  if (!context || !isUuid(orderId)) notFound();

  const order = await findOrderForThankYou(context.store._id, orderId);
  if (!order || order.productId !== context.product.id) notFound();

  const theme = resolveTheme(context.store.theme);
  const { preset } = theme;
  const paid = order.status === "paid";

  return (
    <StoreFrame theme={theme}>
      <div className="flex w-full flex-col items-center gap-4 p-8 text-center" style={cardStyle(theme)}>
        {paid ? <CheckCircle2 aria-hidden="true" className="size-12" style={{ color: theme.accent }} /> : <Clock aria-hidden="true" className="size-12" style={{ color: preset.muted }} />}
        <h1 className="font-display text-h2" style={{ fontWeight: preset.displayWeight }}>
          {paid ? "Thank you!" : order.status === "pending" ? "Confirming your payment" : "This order isn't paid"}
        </h1>
        <p className="max-w-sm break-words whitespace-pre-line" style={{ color: preset.muted }}>
          {paid
            ? context.product.thankYou || `Your purchase of ${context.product.title} is confirmed.`
            : order.status === "pending"
              ? "This can take a moment. Refresh this page in a few seconds."
              : "Something went wrong with this payment. You were not charged for this order."}
        </p>
        {paid && (
          <Link href="/library" className="font-semibold underline underline-offset-4">
            Open your purchase in your library
          </Link>
        )}
        <Link href={`/@${context.store.slug}`} className="font-semibold underline underline-offset-4">
          Back to {context.store.name}
        </Link>
      </div>
    </StoreFrame>
  );
}
