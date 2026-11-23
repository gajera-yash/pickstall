import { CalendarCheck, Megaphone, Upload } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AdminSearch } from "@/components/admin/admin-search";
import { AdminPageTitle, Stat, queryText } from "@/components/admin/admin-ui";
import { ProgressBadge, StageBadge, toolText } from "@/components/admin/growth/lead-ui";
import { FilterSelect } from "@/components/dashboard/details-sheet";
import { formatDay, ListCard } from "@/components/dashboard/orders-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin/guard";
import { listLeads, type LeadFilters } from "@/lib/marketing/leads";
import { LEAD_PLATFORM_LABELS, LEAD_STAGES, LEAD_STAGE_LABELS, LEAD_TOOLS, LEAD_TOOL_LABELS, formatFollowers, type LeadStage, type LeadTool } from "@/lib/marketing/leads-rules";
import { withQuery } from "@/lib/orders/params";

const PATH = "/admin/growth";
const ALL = "all";

// Admin Growth (D-120): the founder's outreach list, most followers first, with each lead's stage and
// how far their store got. Signing up is read from the store (their own link, or the same profile).
export default function AdminGrowthPage({ searchParams }: PageProps<"/admin/growth">) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminPageTitle title="Growth" description="Creators to contact. Copy a lead's own link into your message: their signup shows here by itself." />
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/growth/settings" className="text-sm font-semibold text-blue underline underline-offset-4">
            Settings
          </Link>
          <Link href="/admin/growth/export" prefetch={false} className="text-sm font-semibold text-blue underline underline-offset-4">
            Download CSV
          </Link>
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/growth/import">
              <Upload aria-hidden="true" className="size-4" />
              Import a list
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/growth/today">
              <CalendarCheck aria-hidden="true" className="size-4" />
              Today
            </Link>
          </Button>
        </div>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <GrowthContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** A free-text filter, where the "all" choice means no filter. */
function notAll(value: string | undefined): string | undefined {
  return value === ALL ? undefined : value;
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

async function GrowthContent({ searchParams }: Pick<PageProps<"/admin/growth">, "searchParams">) {
  const [, raw] = await Promise.all([requireAdmin(), searchParams]);
  const stageValue = queryText(raw.stage, 20);
  const filters: LeadFilters = {
    stage: stageValue === "signed_up" ? "signed_up" : pick<LeadStage>(stageValue, LEAD_STAGES),
    tool: pick<LeadTool>(queryText(raw.tool, 20), LEAD_TOOLS),
    topic: notAll(queryText(raw.topic, 80)),
    country: notAll(queryText(raw.country, 60)),
    q: queryText(raw.q, 60),
    page: Math.max(0, Number.parseInt(queryText(raw.page, 4) ?? "0", 10) || 0),
  };
  const { rows, hasMore, counts, topics, countries } = await listLeads(filters);
  const filtered = Boolean(filters.stage || filters.tool || filters.topic || filters.country || filters.q);
  const keep = { stage: filters.stage, tool: filters.tool, topic: filters.topic, country: filters.country, q: filters.q };

  if (counts.total === 0) {
    return (
      <EmptyState icon={Megaphone} title="No leads yet">
        Import your creator list as a CSV (from Google Sheets: File, Download, CSV). Each creator gets a personal link to put in your message.
      </EmptyState>
    );
  }

  const count = (value: number) => value.toLocaleString("en");
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Lead counts" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Leads" value={count(counts.total)} hint={`${count(counts.byStage.new)} not contacted yet`} />
        <Stat label="Contacted" value={count(counts.byStage.contacted + counts.byStage.replied + counts.byStage.interested + counts.byStage.call_booked)} hint={`${count(counts.byStage.replied)} replied · ${count(counts.byStage.interested + counts.byStage.call_booked)} interested`} />
        <Stat label="Signed up" value={count(counts.signedUp)} hint={`${count(counts.live)} with a live store`} />
        <Stat label="First sale" value={count(counts.firstSale)} hint={`${count(counts.paidPlan)} on a paid plan`} />
      </section>

      <div className="flex flex-col gap-3">
        <AdminSearch action={PATH} q={filters.q} placeholder="Name or handle..." label="Search leads" />
        <form method="get" action={PATH} className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
          {filters.q && <input type="hidden" name="q" value={filters.q} />}
          <div className="sm:w-48">
            <FilterSelect
              label="Stage"
              name="stage"
              value={filters.stage ?? ALL}
              options={[{ value: ALL, label: "All stages" }, ...LEAD_STAGES.map((value) => ({ value, label: LEAD_STAGE_LABELS[value] })), { value: "signed_up", label: "Signed up" }]}
            />
          </div>
          <div className="sm:w-44">
            <FilterSelect label="Current tool" name="tool" value={filters.tool ?? ALL} options={[{ value: ALL, label: "All tools" }, ...LEAD_TOOLS.map((value) => ({ value, label: LEAD_TOOL_LABELS[value] }))]} />
          </div>
          {topics.length > 0 && (
            <div className="sm:w-52">
              <FilterSelect label="Course topic" name="topic" value={filters.topic ?? ALL} options={[{ value: ALL, label: "All topics" }, ...topics.map((value) => ({ value, label: value }))]} />
            </div>
          )}
          {countries.length > 0 && (
            <div className="sm:w-44">
              <FilterSelect label="Country" name="country" value={filters.country ?? ALL} options={[{ value: ALL, label: "All countries" }, ...countries.map((value) => ({ value, label: value }))]} />
            </div>
          )}
          {filtered && (
            <Link href={PATH} className="self-center text-sm font-semibold text-blue underline underline-offset-4">
              Clear filters
            </Link>
          )}
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Megaphone} title="No leads match">
          Try another stage, tool or search.
        </EmptyState>
      ) : (
        <ListCard>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Creator</TableHead>
                <TableHead className="text-right">Followers</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Last contacted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="max-w-56">
                    <Link href={`${PATH}/${row._id}`} className="flex flex-col hover:underline">
                      <span className="truncate font-semibold">{row.name ?? `@${row.handle}`}</span>
                      <span className="truncate text-xs text-mute">
                        @{row.handle}
                        {row.platform !== "instagram" ? ` · ${LEAD_PLATFORM_LABELS[row.platform]}` : ""}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatFollowers(row.followers)}</TableCell>
                  <TableCell className="max-w-40 truncate">{row.topic ?? <span className="text-mute">-</span>}</TableCell>
                  <TableCell className="whitespace-nowrap">{toolText(row.tool, row.toolLabel)}</TableCell>
                  <TableCell className="max-w-32 truncate">{row.country ?? <span className="text-mute">-</span>}</TableCell>
                  <TableCell>
                    <StageBadge stage={row.stage} />
                  </TableCell>
                  <TableCell>
                    <ProgressBadge store={row.store} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-mute">{row.lastContactedAt ? formatDay(row.lastContactedAt) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ListCard>
      )}

      {(filters.page > 0 || hasMore) && (
        <nav aria-label="Pages" className="flex items-center gap-3">
          {filters.page > 0 && (
            <Button asChild variant="secondary">
              <Link href={withQuery(PATH, { ...keep, page: filters.page > 1 ? String(filters.page - 1) : undefined })}>Previous</Link>
            </Button>
          )}
          {hasMore && (
            <Button asChild variant="secondary">
              <Link href={withQuery(PATH, { ...keep, page: String(filters.page + 1) })}>Next</Link>
            </Button>
          )}
          <span className="text-sm text-mute">Page {filters.page + 1}</span>
        </nav>
      )}
    </div>
  );
}
