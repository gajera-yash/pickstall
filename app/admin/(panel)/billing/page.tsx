import { CreditCard } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AdminBarChart } from "@/components/admin/admin-chart";
import { AdminPageTitle, Stat, moneyList } from "@/components/admin/admin-ui";
import { ImportInvoicesButton } from "@/components/admin/import-invoices-button";
import { formatDay } from "@/components/dashboard/orders-ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminBilling } from "@/lib/admin/billing";
import { requireAdmin } from "@/lib/admin/guard";
import { formatMoney } from "@/lib/products/money";

// Platform billing (D-116): what creators pay Pickstall for plans, on our own Stripe account. MRR
// comes from active subscriptions at their Stripe price; revenue from saved paid plan invoices.
export default function AdminBillingPage() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminPageTitle title="Billing" description="Plan subscriptions and what creators paid Pickstall. This is platform revenue, not creators' sales." />
        <ImportInvoicesButton />
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <BillingContent />
      </Suspense>
    </>
  );
}

const usd = (cents: number) => formatMoney(cents, "usd");

async function BillingContent() {
  await requireAdmin();
  const data = await adminBilling();
  const mrrUsd = data.mrr.find((row) => row.currency === "usd")?.cents ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Recurring revenue" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="MRR" value={moneyList(data.mrr)} hint="Active and past-due plans, monthly" />
        <Stat label="ARR" value={data.mrr.length ? usd(mrrUsd * 12) : "-"} hint="MRR × 12" />
        <Stat label="Active plans" value={(data.active.starter + data.active.pro).toLocaleString("en")} hint={`Starter ${data.active.starter} · Pro ${data.active.pro}`} />
        <Stat label="New this month" value={data.newThisMonth.toLocaleString("en")} hint={`${data.canceled30} cancelled in 30 days`} />
      </section>
      <section aria-label="Revenue" className="grid gap-3 sm:grid-cols-3">
        <Stat label="Revenue this month" value={moneyList(data.revenueThisMonth)} />
        <Stat label="Revenue all time" value={moneyList(data.revenueAll)} />
        <Stat label="Plan payments" value={data.payments.toLocaleString("en")} hint="Paid invoices saved" />
      </section>

      <Card className="gap-3">
        <h2 className="font-display text-h4">Revenue by month (USD)</h2>
        <AdminBarChart title="Plan revenue by month" labels={data.months.map((month) => month.label)} values={data.months.map((month) => month.cents)} format={usd} />
      </Card>

      {data.pastDue.length > 0 && (
        <Card className="gap-3">
          <h2 className="font-display text-h4">Payment problems</h2>
          <p className="text-sm text-mute">Stripe is retrying these payments. The creator keeps their plan while it does.</p>
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {data.pastDue.map((row) => (
              <li key={row.storeId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <Link href={`/admin/creators/${row.storeId}`} className="font-semibold hover:underline">
                  {row.name} <span className="font-normal text-mute">@{row.slug}</span>
                </Link>
                <span className="flex items-center gap-2 text-sm text-mute">
                  <Badge variant="danger">{row.plan ?? "plan"} past due</Badge>
                  since {formatDay(row.since)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-h4">Latest plan payments</h2>
          <Link href="/admin/billing/export" className="text-sm font-semibold text-blue underline underline-offset-4" prefetch={false}>
            Download CSV
          </Link>
        </div>
        {data.recent.length === 0 ? (
          <EmptyState icon={CreditCard} title="No plan payments yet">
            Paid plan invoices appear here as Stripe sends them. Import older ones with the button above.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead numeric>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.storeId ? (
                      <Link href={`/admin/creators/${row.storeId}`} className="font-semibold hover:underline">
                        {row.storeName}
                      </Link>
                    ) : (
                      <span className="text-mute">{row.storeName}</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{row.plan ?? "-"}</TableCell>
                  <TableCell className="text-mute">{formatDay(row.paidAt)}</TableCell>
                  <TableCell numeric>{formatMoney(row.amountCents, row.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
