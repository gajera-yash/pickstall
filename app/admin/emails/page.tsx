import Link from "next/link";
import { Suspense } from "react";

import { AdminPageTitle, Stat } from "@/components/admin/admin-ui";
import { formatDay, ListCard } from "@/components/dashboard/orders-ui";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { adminEmailStats } from "@/lib/admin/queries";

// Admin: broadcasts and list health across stores (D-104). Every creator sends from the shared
// Pickstall domain, so stores with many spam complaints or bounces need a look.
export default function AdminEmailsPage() {
  return (
    <>
      <AdminPageTitle title="Emails" description="Broadcasts and list health. Spam complaints and bounces from any store hurt the shared sending domain." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <EmailsContent />
      </Suspense>
    </>
  );
}

const STATUS_VARIANT: Record<string, "live" | "draft" | "danger" | "testMode"> = { sent: "live", sending: "testMode", failed: "danger", draft: "draft" };

async function EmailsContent() {
  await requireAdmin();
  const data = await adminEmailStats();
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Broadcasts, 30 days" value={data.broadcasts30.toLocaleString("en")} hint={`${data.failed30} failed`} />
        <Stat label="Emails sent, 30 days" value={data.sent30.toLocaleString("en")} />
        <Stat label="Spam complaints" value={data.complained.toLocaleString("en")} hint="All time, all stores" />
        <Stat label="Bounces" value={data.bounced.toLocaleString("en")} hint="Permanent, all time" />
      </section>

      <section aria-labelledby="admin-complaints" className="flex flex-col gap-3">
        <h2 id="admin-complaints" className="font-display text-h3">
          Stores with complaints or bounces
        </h2>
        {data.topComplaints.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-mute">No complaints or bounces yet.</p>
        ) : (
          <ListCard>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Store</TableHead>
                  <TableHead numeric>Complaints</TableHead>
                  <TableHead numeric>Bounces</TableHead>
                  <TableHead numeric>Subscribed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topComplaints.map((row) => (
                  <TableRow key={row.storeId}>
                    <TableCell>
                      <Link href={`/admin/creators/${row.storeId}`} className="text-blue underline underline-offset-4">
                        @{row.storeSlug || "unknown"}
                      </Link>
                    </TableCell>
                    <TableCell numeric className={row.complained > 0 ? "font-semibold text-danger" : ""}>
                      {row.complained}
                    </TableCell>
                    <TableCell numeric>{row.bounced}</TableCell>
                    <TableCell numeric>{row.subscribed.toLocaleString("en")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ListCard>
        )}
      </section>

      <section aria-labelledby="admin-broadcasts" className="flex flex-col gap-3">
        <h2 id="admin-broadcasts" className="font-display text-h3">
          Latest broadcasts
        </h2>
        {data.recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-mute">No broadcasts yet.</p>
        ) : (
          <ListCard>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Subject</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead numeric>Sent</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-72 truncate">{row.subject}</TableCell>
                    <TableCell className="text-mute">@{row.storeSlug}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status] ?? "draft"}>{row.status}</Badge>
                    </TableCell>
                    <TableCell numeric>
                      {row.sentCount} / {row.recipientCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-mute">{formatDay(row.createdAt)}</TableCell>
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
