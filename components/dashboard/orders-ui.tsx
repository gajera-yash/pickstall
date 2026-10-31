import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { OrderRow } from "@/lib/orders/creator-queries";
import { formatMoney } from "@/lib/products/money";

const STATUS: Record<OrderRow["status"], { label: string; variant: "live" | "draft" | "testMode" }> = {
  paid: { label: "Paid", variant: "live" },
  pending: { label: "Pending", variant: "testMode" },
  refunded: { label: "Refunded", variant: "draft" },
  failed: { label: "Failed", variant: "draft" },
};

export function OrderStatusBadge({ status }: { status: OrderRow["status"] }) {
  const { label, variant } = STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

/** A calendar date in UTC, so the same order shows the same day for everyone. */
export function formatDay(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function Answers({ answers }: { answers: { questionId: string; label: string; value: string }[] }) {
  if (answers.length === 0) return <p className="text-sm text-mute">No checkout answers.</p>;
  return (
    <dl className="flex flex-col gap-2 text-sm">
      {answers.map((answer) => (
        <div key={answer.questionId} className="flex flex-col gap-0.5">
          <dt className="font-medium text-mute">{answer.label}</dt>
          <dd className="break-words whitespace-pre-line text-ink">{answer.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One order as a row: product, buyer, amount, status and date, with the buyer's answers one tap away. */
export function OrderListItem({ order }: { order: OrderRow }) {
  const test = order.provider === "mock";
  return (
    <li>
      <details className="group">
        <summary className="flex min-h-[72px] cursor-pointer list-none items-center gap-3 px-2 py-3 hover:bg-bg-subtle sm:gap-4 sm:px-3 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-semibold">{order.title}</span>
            <span className="truncate text-sm text-mute">
              {order.buyerName} · {order.buyerEmail}
            </span>
          </span>
          <span className="hidden text-sm text-mute sm:block">{formatDay(order.createdAt)}</span>
          <span className="flex flex-col items-end gap-1">
            <span className="font-semibold tabular-nums">{formatMoney(order.totalCents, order.currency)}</span>
            <span className="flex items-center gap-1.5">
              {test && <Badge variant="testMode">Test</Badge>}
              <OrderStatusBadge status={order.status} />
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-mute transition-transform duration-(--dur-fast) group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-3 border-t border-line bg-bg-subtle px-4 py-4 sm:px-6">
          <p className="text-sm text-mute sm:hidden">{formatDay(order.createdAt)}</p>
          <Answers answers={order.answers} />
        </div>
      </details>
    </li>
  );
}

export function ListCard({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-line bg-surface">{children}</div>;
}
