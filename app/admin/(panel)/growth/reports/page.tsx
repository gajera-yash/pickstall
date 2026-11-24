import { ArrowLeft, FileBarChart } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AdminPageTitle } from "@/components/admin/admin-ui";
import { SendReportNow } from "@/components/admin/growth/report-ui";
import { formatDateTime, ListCard } from "@/components/dashboard/orders-ui";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { serverEnv } from "@/lib/env.server";
import { shortDay } from "@/lib/marketing/report-email";
import { listReports } from "@/lib/marketing/report-send";

// Daily growth reports (D-122): one per day, built at 21:00 IST by the background job (or now, with
// the button), newest first.
export default function GrowthReportsPage() {
  return (
    <>
      <Link href="/admin/growth" className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        All leads
      </Link>
      <AdminPageTitle title="Daily reports" description="Built every day at 21:00 India time from the database: outreach, signups, what needs attention and tomorrow's priorities." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <ReportsContent />
      </Suspense>
    </>
  );
}

async function ReportsContent() {
  await requireAdmin();
  const reports = await listReports();
  const emailOn = Boolean(serverEnv.GROWTH_REPORT_EMAIL);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-mute">{emailOn ? "Reports are emailed to the address in GROWTH_REPORT_EMAIL." : "No GROWTH_REPORT_EMAIL is set, so reports are saved here but not emailed."}</p>
      <SendReportNow />
      {reports.length === 0 ? (
        <EmptyState icon={FileBarChart} title="No reports yet">
          The first report is built tonight at 21:00 India time, or now with the button above.
        </EmptyState>
      ) : (
        <ListCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Day</TableHead>
                <TableHead className="text-right">DMs</TableHead>
                <TableHead className="text-right">Replies</TableHead>
                <TableHead className="text-right">Signups</TableHead>
                <TableHead>Emailed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report._id}>
                  <TableCell>
                    <Link href={`/admin/growth/reports/${report._id}`} className="font-semibold hover:underline">
                      {shortDay(report._id)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{report.data?.outreach?.dmsSent ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{report.data?.outreach?.replies ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{report.data?.funnel?.signups ?? 0}</TableCell>
                  <TableCell className="whitespace-nowrap text-mute">{report.emailedAt ? formatDateTime(report.emailedAt) : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListCard>
      )}
    </div>
  );
}
