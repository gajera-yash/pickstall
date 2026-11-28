import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminPageTitle } from "@/components/admin/admin-ui";
import { formatDateTime } from "@/components/dashboard/orders-ui";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { reportRows, shortDay } from "@/lib/marketing/report-email";
import { getReport } from "@/lib/marketing/report-send";

// One daily growth report (D-122), the same content as its email.
export default function GrowthReportPage({ params }: PageProps<"/admin/growth/reports/[day]">) {
  return (
    <>
      <Link href="/admin/growth/reports" className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        All reports
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <ReportContent params={params} />
      </Suspense>
    </>
  );
}

async function ReportContent({ params }: Pick<PageProps<"/admin/growth/reports/[day]">, "params">) {
  const [, { day }] = await Promise.all([requireAdmin(), params]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) notFound();
  const report = await getReport(day);
  if (!report) notFound();
  const { data } = report;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageTitle title={`Report, ${shortDay(day)}`} description={`From ${formatDateTime(report.windowStart)} to ${formatDateTime(report.windowEnd)}. ${report.emailedAt ? `Emailed ${formatDateTime(report.emailedAt)}.` : "Not emailed."}`} />

      <Card className="gap-3">
        <h2 className="font-display text-h4">Tomorrow</h2>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          {data.priorities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {reportRows(data).map((section) => (
          <Card key={section.title} className="gap-2">
            <h2 className="font-display text-h4">{section.title}</h2>
            <dl className="flex flex-col">
              {section.rows.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-sm last:border-b-0">
                  <dt className="text-mute">{label}</dt>
                  <dd className="text-right font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-3">
          <h2 className="font-display text-h4">Who moved</h2>
          {data.movements.length === 0 ? (
            <p className="text-sm text-mute">Nobody yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {data.movements.map((row) => (
                <li key={`${row.leadId}-${row.at}-${row.what}`}>
                  <Link href={`/admin/growth/${row.leadId}`} className="font-semibold hover:underline">
                    {row.who}
                  </Link>
                  : {row.what}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="gap-3">
          <h2 className="font-display text-h4">Last 7 days</h2>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Day</TableHead>
                <TableHead className="text-right">DMs</TableHead>
                <TableHead className="text-right">Replies</TableHead>
                <TableHead className="text-right">Signups</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.trend.map((row) => (
                <TableRow key={row.day}>
                  <TableCell>{shortDay(row.day)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.dms}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.replies}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.signups}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
      <p className="text-sm text-mute">Website visits are not in this report yet (PostHog comes later).</p>
    </div>
  );
}
