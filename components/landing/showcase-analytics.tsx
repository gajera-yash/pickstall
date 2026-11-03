"use client";

import { m } from "motion/react";
import { Download, ShoppingBag, Users, Wallet } from "lucide-react";
import { useState } from "react";

import { Reveal } from "@/components/landing/motion";
import { Frame } from "@/components/landing/ui";
import { formatMoney } from "@/lib/products/money";
import { cn } from "@/lib/utils";

// Analytics (D-039): the Income view with example numbers. One series (revenue per day) in blue,
// recessive grid, a hover tooltip per bar and a screen-reader summary (DESIGN.md 3.3). The data is
// a fixed pattern, not random, so the server and client render the same thing.

const RANGES = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

const PRICES = [900, 1900, 2900, 1500];

/** Example day `i`: a gentle upward trend with a weekly rhythm, in whole sales. */
function dayOrders(i: number): number {
  return 1 + ((i * 7) % 5) + Math.floor(i / 6);
}

function series(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const i = 30 - days + index;
    const orders = dayOrders(i);
    const cents = Array.from({ length: orders }, (_, k) => PRICES[(i + k) % PRICES.length] ?? 0).reduce((a, b) => a + b, 0);
    return { day: days - index - 1, orders, cents };
  });
}

const ORDERS = [
  { buyer: "Jordan L.", product: "Budget workbook", cents: 900 },
  { buyer: "Sam R.", product: "Tax season checklist", cents: 1900 },
  { buyer: "Priya K.", product: "Template pack", cents: 2900 },
];

export function AnalyticsShowcase() {
  const [rangeId, setRangeId] = useState<RangeId>("7d");
  const range = RANGES.find((item) => item.id === rangeId) ?? RANGES[0];
  const data = series(range.days);
  const revenue = data.reduce((sum, day) => sum + day.cents, 0);
  const orders = data.reduce((sum, day) => sum + day.orders, 0);
  const customers = Math.round(orders * 0.86);
  const max = Math.max(...data.map((day) => day.cents));
  const top = Math.ceil(max / 5000) * 5000;

  const kpis = [
    { icon: Wallet, label: "Revenue", value: formatMoney(revenue, "usd"), tone: "text-mint" },
    { icon: ShoppingBag, label: "Orders", value: String(orders), tone: "text-ink" },
    { icon: Users, label: "Customers", value: String(customers), tone: "text-ink" },
  ];

  return (
    <Frame address="Dashboard / Income" bodyClassName="flex flex-col gap-6 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-h3">Income</p>
        <div role="radiogroup" aria-label="Date range" className="flex gap-1 rounded-md border border-line bg-bg-subtle p-1">
          {RANGES.map((item) => {
            const on = item.id === rangeId;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setRangeId(item.id)}
                className={cn("relative min-h-10 rounded-sm px-4 text-sm font-semibold", on ? "text-ink" : "text-mute hover:text-ink")}
              >
                {on && (
                  <m.span
                    layoutId="range-active"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-sm border border-line bg-surface"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-3" aria-live="polite">
        {kpis.map(({ icon: Icon, label, value, tone }) => (
          <div key={label} className="flex min-w-0 flex-col gap-1 rounded-md border border-line p-3 sm:p-4">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-mute">
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {label}
            </dt>
            <dd className={cn("truncate font-display text-money-m tabular-nums sm:text-money-l", tone)}>{value}</dd>
          </div>
        ))}
      </dl>

      <figure className="flex flex-col gap-2">
        <figcaption className="text-sm font-semibold">Revenue per day, last {range.label}</figcaption>
        <div className="relative h-44 sm:h-52">
          <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
            {[top, top / 2, 0].map((tick) => (
              <div key={tick} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-right text-xs text-mute tabular-nums">${tick / 100}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            ))}
          </div>
          <Reveal variant="grow" className="absolute inset-y-0 right-0 left-12 h-full">
            <div aria-hidden="true" className={cn("flex h-full items-end", range.days > 7 ? "gap-0.5" : "gap-2 sm:gap-4")}>
              {data.map((day) => (
                <div key={`${rangeId}-${day.day}`} className="group relative flex h-full flex-1 items-end">
                  <span
                    className="w-full rounded-t-xs bg-blue transition-opacity duration-(--dur-fast) group-hover:opacity-80"
                    style={{ height: `${(day.cents / top) * 100}%` }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-sm bg-surface px-2 py-1 text-xs whitespace-nowrap shadow-popover group-hover:block">
                    <span className="block text-mute">{day.day === 0 ? "Today" : `${day.day} days ago`}</span>
                    <span className="block font-semibold tabular-nums">{formatMoney(day.cents, "usd")}</span>
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
        <p className="sr-only">
          Example data: {formatMoney(revenue, "usd")} from {orders} orders over {range.label}, highest day {formatMoney(max, "usd")}.
        </p>
      </figure>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Recent orders</p>
          <span aria-hidden="true" className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-semibold">
            <Download className="size-3.5" />
            Export CSV
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {ORDERS.map((order) => (
            <li key={order.buyer} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
              <span className="font-semibold">{order.buyer}</span>
              <span className="min-w-0 flex-1 truncate text-mute">{order.product}</span>
              <span className="rounded-full bg-mint-soft px-2 py-0.5 text-xs font-semibold text-mint">Platform fee $0.00</span>
              <span className="font-semibold tabular-nums">{formatMoney(order.cents, "usd")}</span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}
