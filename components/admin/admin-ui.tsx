import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/products/money";
import type { StoreAccess } from "@/lib/plans/access";

// Small building blocks for the admin pages (D-104).

export function AdminPageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-display text-h2">{title}</h1>
      {description && <p className="text-sm text-mute">{description}</p>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4">
      <span className="text-xs font-semibold tracking-wide text-mute uppercase">{label}</span>
      <span className="font-display text-h2 tabular-nums">{value}</span>
      {hint && <span className="text-xs text-mute">{hint}</span>}
    </div>
  );
}

/** Money in several currencies ("$120.00 · ₹4,000"), or a dash. */
export function moneyList(rows: { currency: string; cents: number }[]): string {
  return rows.length === 0 ? "-" : rows.map((row) => formatMoney(row.cents, row.currency)).join(" · ");
}

export function PlanBadge({ access }: { access: StoreAccess }) {
  if (access.plan) return <Badge variant={access.state === "past_due" ? "danger" : "live"}>{access.plan === "pro" ? "Pro" : "Starter"}{access.state === "past_due" ? " (past due)" : ""}</Badge>;
  if (access.state === "founding") return <Badge variant="live">Founding</Badge>;
  if (access.state === "trial") return <Badge variant="testMode">Trial{access.daysLeft !== null ? ` · ${access.daysLeft}d` : ""}</Badge>;
  return <Badge variant="danger">Paused</Badge>;
}

/** The text of a search box value from the URL, trimmed and cut. */
export function queryText(value: string | string[] | undefined, max = 100): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const text = first?.trim().slice(0, max);
  return text ? text : undefined;
}
