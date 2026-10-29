"use client";

import { CalendarDays, Check, ChevronDown, DollarSign, ShoppingCart, Users, type LucideIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;
type RangeDays = (typeof RANGES)[number];

export type KpiSeries = { revenueCents: number[]; orders: number[]; customers: number[] };

type Props = { currency: string; series: KpiSeries };

const noSubscribe = () => () => {};

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** The date range label, computed in the browser so it uses the viewer's own calendar day. */
function useRangeLabel(days: RangeDays): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - (days - 1));
      const format = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
      return `${format.format(start)} – ${format.format(end)}`;
    },
    () => null,
  );
}

/**
 * "Last 30 days" KPI cards (reference docs/ui-reference/dashboard.webp): revenue, orders and
 * customers with a sparkline each, and a range picker. Values are real (zero until the first sale);
 * the series are per day, newest last. Money is integer cents.
 */
export function KpiSection({ currency, series }: Props) {
  const [days, setDays] = useState<RangeDays>(30);
  const label = useRangeLabel(days);
  const slice = (values: number[]) => values.slice(-days);

  const money = new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() });
  const cards: { label: string; value: string; icon: LucideIcon; tone: string; points: number[] }[] = [
    { label: "Revenue", value: money.format(sum(slice(series.revenueCents)) / 100), icon: DollarSign, tone: "text-blue bg-blue-soft", points: slice(series.revenueCents) },
    { label: "Orders", value: String(sum(slice(series.orders))), icon: ShoppingCart, tone: "text-violet bg-violet-soft", points: slice(series.orders) },
    { label: "Customers", value: String(sum(slice(series.customers))), icon: Users, tone: "text-mint bg-mint-soft", points: slice(series.customers) },
  ];

  return (
    <section aria-labelledby="kpi-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="kpi-title" className="font-display text-h2">
          Last {days} days
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-11 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-bg-subtle data-[state=open]:bg-bg-subtle">
            <CalendarDays aria-hidden="true" className="size-4 text-mute" />
            <span className="tabular-nums">{label ?? `Last ${days} days`}</span>
            <ChevronDown aria-hidden="true" className="size-4 text-mute" />
            <span className="sr-only">Change the date range</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {RANGES.map((range) => (
              <DropdownMenuItem key={range} onSelect={() => setDays(range)}>
                <Check aria-hidden="true" className={cn("text-blue", range === days ? "opacity-100" : "opacity-0")} />
                Last {range} days
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ label: cardLabel, value, icon: Icon, tone, points }) => (
          <li key={cardLabel}>
            <Card className="flex-row items-center gap-4 p-5 sm:p-5">
              <span aria-hidden="true" className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", tone)}>
                <Icon className="size-6" />
              </span>
              <div className="flex min-w-0 flex-col">
                <p className="text-sm font-medium text-mute">{cardLabel}</p>
                <p className="font-display text-money-l text-ink tabular-nums">{value}</p>
              </div>
              <Sparkline points={points} className={cn("ml-auto hidden h-10 w-24 shrink-0 min-[1100px]:block xl:w-28", tone.split(" ")[0])} />
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Small trend line. All-zero data draws a flat line at the bottom, never a made-up curve. */
function Sparkline({ points, className }: { points: number[]; className?: string }) {
  const width = 120;
  const height = 40;
  const values = points.length > 1 ? points : [0, 0];
  const max = Math.max(...values, 0);
  const step = width / (values.length - 1);
  const y = (value: number) => (max === 0 ? height - 4 : height - 4 - (value / max) * (height - 8));
  const line = values.map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)},${y(value).toFixed(1)}`).join(" ");

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={className}>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill="currentColor" opacity={0.08} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
