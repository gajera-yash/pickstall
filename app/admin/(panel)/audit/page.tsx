import { ScrollText } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AdminPageTitle, queryText } from "@/components/admin/admin-ui";
import { FilterSelect } from "@/components/dashboard/details-sheet";
import { formatDateTime, ListCard } from "@/components/dashboard/orders-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { adminListAudit } from "@/lib/admin/queries";
import { AUDIT_LABELS } from "@/lib/audit/labels";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit/log";
import { isUuid } from "@/lib/media/media";
import { withQuery } from "@/lib/orders/params";

// Admin audit log (D-116): sign-ins, plan changes and every admin action across the platform, newest
// first, filterable by action. Records keep ids and a hashed IP only; actors show as admin name,
// "creator" or "system". Records expire after 400 days (D-075).
const PATH = "/admin/audit";
const ALL = "all";
/** Actions that can no longer happen (D-109 removed the admin password change), left out of the filter. */
const RETIRED: readonly AuditAction[] = ["admin.password_changed"];

export default function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <>
      <AdminPageTitle title="Audit log" description="Who did what, and when: admin actions, plan changes and sign-ins. Kept for 400 days." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <AuditContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Short, safe details: the reason an admin gave, a plan, a number of days or months. */
function detail(meta: Record<string, string | number | boolean>): string {
  const parts: string[] = [];
  for (const key of ["reason", "plan", "days", "months", "seen", "added"] as const) {
    const value = meta[key];
    if (value !== undefined && value !== "" && value !== "unknown") parts.push(key === "reason" ? String(value) : `${key} ${value}`);
  }
  return parts.join(" · ") || "-";
}

async function AuditContent({ searchParams }: Pick<PageProps<"/admin/audit">, "searchParams">) {
  const [, raw] = await Promise.all([requireAdmin(), searchParams]);
  const actionRaw = queryText(raw.action, 60);
  const action = actionRaw && (AUDIT_ACTIONS as readonly string[]).includes(actionRaw) ? (actionRaw as AuditAction) : undefined;
  const storeRaw = queryText(raw.store, 40);
  const storeId = storeRaw && isUuid(storeRaw) ? storeRaw : undefined;
  const beforeRaw = queryText(raw.before, 40);
  const before = beforeRaw && !Number.isNaN(Date.parse(beforeRaw)) ? new Date(beforeRaw) : undefined;
  const { rows, nextBefore } = await adminListAudit({ action, storeId, before });

  return (
    <div className="flex flex-col gap-4">
      <form method="get" action={PATH} className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <FilterSelect label="Action" name="action" value={action ?? ALL} options={[{ value: ALL, label: "All actions" }, ...AUDIT_ACTIONS.filter((value) => !RETIRED.includes(value)).map((value) => ({ value, label: AUDIT_LABELS[value] }))]} />
        </div>
        {storeId && <input type="hidden" name="store" value={storeId} />}
        {(action || storeId) && (
          <Link href={PATH} className="text-sm font-semibold text-blue underline underline-offset-4">
            Clear filters
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nothing here yet">
          Actions appear here as they happen.
        </EmptyState>
      ) : (
        <ListCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>When (UTC)</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-mute">{formatDateTime(row.at)}</TableCell>
                  <TableCell className="whitespace-nowrap font-semibold">{AUDIT_LABELS[row.action as AuditAction] ?? row.action}</TableCell>
                  <TableCell className="whitespace-nowrap">{row.actor}</TableCell>
                  <TableCell className="max-w-48 truncate">
                    {row.storeId ? (
                      <Link href={`/admin/creators/${row.storeId}`} className="hover:underline">
                        {row.storeName ?? "Deleted store"}
                      </Link>
                    ) : (
                      <span className="text-mute">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-80 truncate text-mute">{detail(row.meta)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListCard>
      )}

      {nextBefore && (
        <Button asChild variant="secondary" className="self-start">
          <Link href={withQuery(PATH, { action: action ?? undefined, store: storeId, before: nextBefore })}>Load more</Link>
        </Button>
      )}
    </div>
  );
}
