import { Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AdminSearch } from "@/components/admin/admin-search";
import { AdminPageTitle, PlanBadge, queryText } from "@/components/admin/admin-ui";
import { formatDay, ListCard } from "@/components/dashboard/orders-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { adminListStores } from "@/lib/admin/queries";
import { withQuery } from "@/lib/orders/params";

const PATH = "/admin/creators";

// Admin: every creator's store, newest first (D-104).
export default function AdminCreatorsPage({ searchParams }: PageProps<"/admin/creators">) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminPageTitle title="Creators" description="Every store, newest first. Search by store name, username or the owner's exact email." />
        <Link href="/admin/creators/export" prefetch={false} className="text-sm font-semibold text-blue underline underline-offset-4">
          Download CSV
        </Link>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <CreatorsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CreatorsContent({ searchParams }: Pick<PageProps<"/admin/creators">, "searchParams">) {
  const [, raw] = await Promise.all([requireAdmin(), searchParams]);
  const q = queryText(raw.q);
  const beforeRaw = queryText(raw.before, 40);
  const before = beforeRaw && !Number.isNaN(new Date(beforeRaw).getTime()) ? new Date(beforeRaw) : undefined;
  const { rows, nextBefore } = await adminListStores({ q, before });
  return (
    <div className="flex flex-col gap-4">
      <AdminSearch action={PATH} q={q} placeholder="Store name, username or owner email..." label="Search creators" />
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No creators found">
          Try another name or email.
        </EmptyState>
      ) : (
        <ListCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Store</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stripe</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="relative">
                  <TableCell className="max-w-64">
                    <Link href={`${PATH}/${row.id}`} className="flex flex-col after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-blue">
                      <span className="truncate font-semibold">{row.name}</span>
                      <span className="truncate text-xs text-mute">@{row.slug}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-mute">{row.ownerEmail || "-"}</TableCell>
                  <TableCell>
                    <PlanBadge access={row.access} />
                  </TableCell>
                  <TableCell>{row.isPublished ? <Badge variant="live">Live</Badge> : <Badge variant="draft">Draft</Badge>}</TableCell>
                  <TableCell>{row.stripeConnected ? <Badge variant="live">Connected</Badge> : <Badge variant="draft">No</Badge>}</TableCell>
                  <TableCell className="whitespace-nowrap text-mute">{formatDay(row.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListCard>
      )}
      {nextBefore && (
        <Button asChild variant="secondary" className="self-center">
          <Link href={withQuery(PATH, { q, before: nextBefore })}>Load more</Link>
        </Button>
      )}
    </div>
  );
}
