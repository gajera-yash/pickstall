import { Suspense } from "react";

import { AdminBarChart } from "@/components/admin/admin-chart";
import { AdminPageTitle, Stat, moneyList } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin/guard";
import { adminBilling } from "@/lib/admin/billing";
import { adminActivity, adminOverview, trialConversion } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/products/money";

// Admin overview (D-104): the platform's numbers at a glance.
export default function AdminOverviewPage() {
  return (
    <>
      <AdminPageTitle title="Overview" description="The whole platform at a glance. Sales are creators' sales, paid into their own Stripe accounts." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <OverviewContent />
      </Suspense>
    </>
  );
}

async function OverviewContent() {
  await requireAdmin();
  const [data, activity, billing] = await Promise.all([adminOverview(), adminActivity(), adminBilling()]);
  const conversion = trialConversion(data);
  const count = (value: number) => value.toLocaleString("en");
  const shortDays = activity.days.map((day) => day.slice(5));
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Creators" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Creators" value={data.creators.toLocaleString("en")} hint={`${data.signups7} new in 7 days · ${data.signups30} in 30 days`} />
        <Stat label="Live stores" value={data.liveStores.toLocaleString("en")} />
        <Stat label="Paid plans" value={(data.paid.starter + data.paid.pro).toLocaleString("en")} hint={`Starter ${data.paid.starter} · Pro ${data.paid.pro}`} />
        <Stat label="MRR" value={billing.mrr.length ? moneyList(billing.mrr) : formatMoney(data.mrrCents, "usd")} hint={`Revenue this month: ${moneyList(billing.revenueThisMonth)}`} />
      </section>
      <section aria-label="Free periods" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="On free trial" value={data.trials.toLocaleString("en")} hint={`${data.trialsEndingSoon} end within 7 days`} />
        <Stat label="Founding" value={data.founding.toLocaleString("en")} />
        <Stat label="Paused" value={data.paused.toLocaleString("en")} hint={`Trial over, no plan · ${conversion === null ? "no trials ended yet" : `${conversion}% of ended trials now pay`}`} />
        <Stat label="Subscribed emails" value={data.subscribers.toLocaleString("en")} hint={`${data.broadcasts30} broadcasts in 30 days`} />
      </section>
      <section aria-label="Last 30 days" className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-3">
          <h2 className="font-display text-h4">New creators, 30 days</h2>
          <AdminBarChart title="New creators per day" labels={shortDays} values={activity.signups} format={count} />
        </Card>
        <Card className="gap-3">
          <h2 className="font-display text-h4">Paid creator orders, 30 days</h2>
          <AdminBarChart title="Paid orders per day" labels={shortDays} values={activity.orders} format={count} />
        </Card>
      </section>
      <section aria-label="Sales" className="grid gap-3 sm:grid-cols-3">
        <Stat label="Orders, 30 days" value={data.orders30.toLocaleString("en")} />
        <Stat label="Creator sales, 30 days" value={moneyList(data.sales30)} />
        <Stat label="Creator sales, all time" value={moneyList(data.salesAll)} />
      </section>
    </div>
  );
}
