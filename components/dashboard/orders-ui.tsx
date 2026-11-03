import { Search } from "lucide-react";
import type { ReactNode } from "react";

import { FilterSelect } from "@/components/dashboard/details-sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import type { OrderRow } from "@/lib/orders/creator-queries";
import { formatMoney } from "@/lib/products/money";

const STATUS: Record<OrderRow["status"], { label: string; variant: "live" | "draft" | "testMode" | "danger" }> = {
  paid: { label: "Paid", variant: "live" },
  pending: { label: "Pending", variant: "testMode" },
  refunded: { label: "Refunded", variant: "danger" },
  failed: { label: "Failed", variant: "draft" },
};

export function OrderStatusBadge({ status }: { status: OrderRow["status"] }) {
  const { label, variant } = STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

/** Status plus a "Test" tag for orders paid through the development mock. */
export function OrderBadges({ status, provider }: Pick<OrderRow, "status" | "provider">) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <OrderStatusBadge status={status} />
      {provider === "mock" && <Badge variant="testMode">Test</Badge>}
    </span>
  );
}

/** A calendar date in UTC, so the same order shows the same day for everyone. */
export function formatDay(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

/** Date and time in UTC for the details drawer. */
export function formatDateTime(date: Date | null): string {
  if (!date) return "";
  return `${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date)} UTC`;
}

/** A short, readable order number ("#3F2A9C1B") from the order's uuid. */
export function orderNumber(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export function Initial({ name }: { name: string }) {
  return (
    <Avatar aria-hidden="true">
      <AvatarFallback>{name.trim().charAt(0).toUpperCase() || "?"}</AvatarFallback>
    </Avatar>
  );
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

/** A titled block inside a details drawer. */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-wide text-mute uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Label and value rows inside a drawer section. */
export function DetailList({ rows }: { rows: { label: string; value: ReactNode; numeric?: boolean }[] }) {
  return (
    <dl className="flex flex-col divide-y divide-line rounded-md border border-line text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex min-h-11 items-center justify-between gap-4 px-3 py-2">
          <dt className="text-mute">{row.label}</dt>
          <dd className={row.numeric ? "text-right font-semibold tabular-nums" : "min-w-0 text-right break-words"}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The search box and product filter above a table: a plain GET form, so it works without JS, and
 * the filter applies itself on change. `keep` carries the other query values (like the status).
 */
export function ListToolbar({
  action,
  q,
  product,
  products,
  keep = {},
  searchLabel,
}: {
  action: string;
  q?: string;
  product?: string;
  products: { id: string; title: string }[];
  keep?: Record<string, string | undefined>;
  searchLabel: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {Object.entries(keep).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <InputGroup className="h-10 sm:w-72">
        <InputGroupInput type="search" name="q" aria-label={searchLabel} defaultValue={q ?? ""} maxLength={80} placeholder="Search name or email..." className="text-sm" />
        <InputGroupAddon>
          <Search aria-hidden="true" className="size-4" />
        </InputGroupAddon>
      </InputGroup>
      {products.length > 0 && (
        <div className="sm:w-56">
          <FilterSelect label="Filter by product" name="product" value={product ?? ""} options={[{ value: "", label: "All products" }, ...products.map((item) => ({ value: item.id, label: item.title }))]} />
        </div>
      )}
      <Button type="submit" className="sr-only">
        Apply
      </Button>
    </form>
  );
}

/** Orders as rows (product, buyer, amount, status, date), each opening to show the buyer's answers. */
export function OrderAccordion({ orders }: { orders: OrderRow[] }) {
  return (
    <Accordion type="multiple">
      {orders.map((order) => (
        <AccordionItem key={order.id} value={order.id}>
          <AccordionTrigger className="min-h-[72px] gap-3 px-3 font-normal hover:bg-bg-subtle sm:gap-4">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-semibold">{order.title}</span>
              <span className="truncate text-sm text-mute">
                {order.buyerName} · {order.buyerEmail}
              </span>
            </span>
            <span className="hidden text-sm text-mute sm:block">{formatDay(order.createdAt)}</span>
            <span className="flex flex-col items-end gap-1">
              <span className="font-semibold tabular-nums">{formatMoney(order.totalCents, order.currency)}</span>
              <OrderBadges status={order.status} provider={order.provider} />
            </span>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-3 border-t border-line bg-bg-subtle px-4 py-4 sm:px-6">
            <p className="text-sm text-mute sm:hidden">{formatDay(order.createdAt)}</p>
            <Answers answers={order.answers} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function ListCard({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-line bg-surface">{children}</div>;
}
