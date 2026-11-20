import { Suspense } from "react";

import { AdminPageTitle, Stat } from "@/components/admin/admin-ui";
import { formatDateTime, ListCard } from "@/components/dashboard/orders-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { adminHealth } from "@/lib/admin/queries";

// Admin: signs that something needs attention, and storage use (D-104). Inngest, Stripe, Resend,
// Bunny and Sentry keep their own detailed logs; this page shows what our database knows.
export default function AdminHealthPage() {
  return (
    <>
      <AdminPageTitle title="Health" description="Webhooks, background work and storage. Details live in Stripe, Inngest, Resend, Bunny and Sentry." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <HealthContent />
      </Suspense>
    </>
  );
}

async function HealthContent() {
  await requireAdmin();
  const data = await adminHealth();
  const hooks = (source: string) => data.webhooks24h.find((row) => row.source === source)?.count ?? 0;
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Webhooks" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Stripe webhooks, 24h" value={(hooks("stripe") + hooks("stripe-connect")).toLocaleString("en")} hint="Handled events" />
        <Stat label="Bunny webhooks, 24h" value={hooks("bunny").toLocaleString("en")} />
        <Stat label="Resend webhooks, 24h" value={hooks("resend").toLocaleString("en")} hint="Bounces and complaints" />
        <Stat label="Unpaid checkouts, 24h" value={data.unpaidOrders24h.toLocaleString("en")} hint="Pending or failed" />
      </section>
      <section aria-label="Background work" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Stuck broadcasts" value={data.stuckBroadcasts.toLocaleString("en")} hint="Sending for over an hour: check Inngest is synced" />
        <Stat label="Unfinished uploads" value={data.pendingUploads.toLocaleString("en")} hint="Cleaned up daily" />
        <Stat label="Database" value={data.database ? `${data.database.dataMb} MB` : "-"} hint={data.database ? `${data.database.storageMb} MB on disk · ${data.database.collections} collections` : "Stats not available"} />
        <Stat label="Images in database" value={`${data.imagesMb} MB`} hint="Move to R2 before the database fills" />
      </section>

      <section aria-labelledby="admin-audit" className="flex flex-col gap-3">
        <h2 id="admin-audit" className="font-display text-h3">
          Latest audit log
        </h2>
        {data.auditRecent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-mute">Nothing logged yet.</p>
        ) : (
          <ListCard>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Action</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>When (UTC)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.auditRecent.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-xs">{row.action}</TableCell>
                    <TableCell className="font-mono text-xs text-mute">{row.storeId ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap text-mute">{formatDateTime(row.at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ListCard>
        )}
      </section>
    </div>
  );
}
