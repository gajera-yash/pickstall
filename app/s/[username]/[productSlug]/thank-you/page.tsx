import { CalendarPlus, CheckCircle2, Clock, Library, Mail, RefreshCw, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductThumb } from "@/components/store/order-summary";
import { StoreFrame, borderColor, cardStyle, resolveTheme } from "@/components/store/store-theme";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";
import { formatCallTime } from "@/lib/coaching/ics";
import { isUuid } from "@/lib/media/media";
import { findOrderForThankYou, loadCheckoutContext } from "@/lib/orders/queries";

export const instant = false;
export const metadata: Metadata = { title: `Thank you | ${APP_NAME}`, robots: { index: false } };

// A booked coaching call (D-087): the email carries the booking and a calendar file.
const CALL_NEXT_STEPS = [
  { icon: Mail, title: "Check your email", body: "We sent your booking with a calendar file and the meeting details." },
  { icon: CalendarPlus, title: "Add it to your calendar", body: "Open the calendar file from the email, or use your library." },
  { icon: Library, title: "See it in your library", body: "Your booking stays there, with the join link when it's time." },
] as const;

const NEXT_STEPS = [
  { icon: Mail, title: "Check your email", body: "We sent your receipt and a link to your purchase." },
  { icon: CheckCircle2, title: "Create your password", body: "New here? The email link lets you set it. Already have one? Skip this." },
  { icon: Library, title: "Open your library", body: "Everything you buy stays there, on any device." },
] as const;

// Where buyers land after paying. It shows a message only; it never grants access (only the verified
// payment event does). The order id is an unguessable uuid and must belong to this store.
// Redesigned in D-069: a clear status, the product, and what to do next.
export default async function ThankYouPage({ params, searchParams }: PageProps<"/s/[username]/[productSlug]/thank-you">) {
  const [{ username, productSlug }, query] = await Promise.all([params, searchParams]);
  const orderId = typeof query.order === "string" ? query.order : "";
  const context = await loadCheckoutContext(username, productSlug);
  if (!context || !isUuid(orderId)) notFound();

  const order = await findOrderForThankYou(context.store._id, orderId);
  if (!order || order.productId !== context.product.id) notFound();

  const { store, product } = context;
  const theme = resolveTheme(store.theme);
  const { preset } = theme;
  const paid = order.status === "paid";
  const pending = order.status === "pending";
  const button = { borderRadius: Math.min(preset.radiusPx, 12) };
  const Icon = paid ? CheckCircle2 : pending ? Clock : XCircle;

  return (
    <StoreFrame theme={theme}>
      <div className="flex w-full flex-col gap-6 p-6 @xl:p-8" style={cardStyle(theme)}>
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="flex size-16 items-center justify-center rounded-full"
            style={{ background: `color-mix(in srgb, ${paid ? theme.accent : preset.muted} 16%, transparent)`, color: paid ? theme.accent : preset.muted }}
          >
            <Icon className="size-8" />
          </span>
          <h1 className="font-display text-h2" style={{ fontWeight: preset.displayWeight }}>
            {paid ? "Thank you!" : pending ? "Confirming your payment" : "This order isn't paid"}
          </h1>
          <p className="max-w-sm break-words whitespace-pre-line" style={{ color: preset.muted }}>
            {paid
              ? product.thankYou || (order.booking ? `Your call is booked: ${formatCallTime(order.booking.start, order.booking.end, order.booking.buyerTimeZone ?? product.coaching?.timeZone ?? null)}.` : `Your purchase of ${product.title} is confirmed.`)
              : pending
                ? "This can take a moment. Refresh this page in a few seconds."
                : "Something went wrong with this payment. You were not charged for this order."}
          </p>
        </div>

        <div className="flex items-center gap-3 border-y py-4" style={{ borderColor: borderColor(preset) }}>
          <ProductThumb product={product} theme={theme} className="size-12" />
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold break-words">{product.title}</span>
            <span className="text-sm break-words" style={{ color: preset.muted }}>
              by {store.name}
            </span>
          </div>
        </div>

        {paid && (
          <section aria-labelledby="next-steps" className="flex flex-col gap-3">
            <h2 id="next-steps" className="text-sm font-semibold">
              What happens next
            </h2>
            <ol className="flex flex-col gap-3">
              {(order.booking ? CALL_NEXT_STEPS : NEXT_STEPS).map((step, index) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ background: theme.accent, color: theme.onAccent }}>
                    {index + 1}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold">{step.title}</span>
                    <span className="text-sm" style={{ color: preset.muted }}>
                      {step.body}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="flex flex-col gap-2">
          {paid ? (
            <Button asChild size="lg" className="w-full" style={{ ...button, background: theme.accent, color: theme.onAccent }}>
              <Link href="/library">
                <Library aria-hidden="true" className="size-4" />
                Open your library
              </Link>
            </Button>
          ) : pending ? (
            <Button asChild size="lg" className="w-full" style={{ ...button, background: theme.accent, color: theme.onAccent }}>
              <Link href={`/@${store.slug}/${product.slug}/thank-you?order=${orderId}`} prefetch={false}>
                <RefreshCw aria-hidden="true" className="size-4" />
                Refresh
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full" style={{ ...button, background: theme.accent, color: theme.onAccent }}>
              <Link href={`/@${store.slug}/${product.slug}`}>Try again</Link>
            </Button>
          )}
          <Link href={`/@${store.slug}`} className="inline-flex min-h-11 items-center justify-center text-sm font-semibold underline underline-offset-4">
            Back to {store.name}
          </Link>
        </div>
      </div>
    </StoreFrame>
  );
}
