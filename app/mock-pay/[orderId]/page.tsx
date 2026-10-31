import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { confirmMockPayment } from "@/lib/orders/actions";
import { findPendingMockOrder } from "@/lib/orders/queries";
import { isUuid } from "@/lib/media/media";
import { formatMoney } from "@/lib/products/money";
import { mockAllowed } from "@/lib/payments/mock";

export const metadata: Metadata = { title: "Test payment | Pickstall", robots: { index: false } };

// Development-only stand-in for Stripe's payment page. In production this route is a 404.
export default function MockPayPage({ params }: PageProps<"/mock-pay/[orderId]">) {
  if (!mockAllowed()) notFound();
  return (
    <Suspense fallback={null}>
      <MockPayContent params={params} />
    </Suspense>
  );
}

async function MockPayContent({ params }: Pick<PageProps<"/mock-pay/[orderId]">, "params">) {
  const { orderId } = await params;
  if (!isUuid(orderId)) notFound();
  const order = await findPendingMockOrder(orderId);
  if (!order) notFound();

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-bg-subtle px-4 py-10">
      <Card className="w-full max-w-md gap-5">
        <div className="flex items-center justify-between gap-2">
          <Wordmark className="h-8" />
          <Badge variant="testMode">Test payment</Badge>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-h2">Pay {formatMoney(order.totalCents, order.currency)}</h1>
          <p className="text-mute">{order.title}</p>
        </div>
        <p className="rounded-md bg-yellow-soft px-4 py-3 text-sm text-warning">This is a development stand-in for Stripe. No real money moves and no card is needed.</p>
        <form action={confirmMockPayment.bind(null, order.id)}>
          <Button type="submit" size="lg" className="w-full">
            Pay (test)
          </Button>
        </form>
      </Card>
    </main>
  );
}
