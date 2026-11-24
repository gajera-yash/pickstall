import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminPageTitle } from "@/components/admin/admin-ui";
import { LeadDraft } from "@/components/admin/growth/draft-ui";
import { LeadEditor } from "@/components/admin/growth/lead-editor";
import { ProgressBadge, StageBadge, toolText } from "@/components/admin/growth/lead-ui";
import { CopyButton } from "@/components/dashboard/details-sheet";
import { formatDateTime, formatDay } from "@/components/dashboard/orders-ui";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin/guard";
import { publicEnv } from "@/lib/env";
import { latestDrafts } from "@/lib/marketing/drafts";
import { leadFit } from "@/lib/marketing/fit";
import { getLead, type LeadDetail } from "@/lib/marketing/leads";
import { LEAD_PLATFORM_LABELS, LEAD_STAGE_LABELS, formatFollowers, leadLink, leadProfileUrl, type LeadStage } from "@/lib/marketing/leads-rules";
import { isUuid } from "@/lib/media/media";

// One outreach lead (D-120): their personal link to paste into a message, their profile, the stage
// and notes, how far their store got, and what happened so far.
export default function AdminLeadPage({ params }: PageProps<"/admin/growth/[id]">) {
  return (
    <>
      <Link href="/admin/growth" className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        All leads
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <LeadContent params={params} />
      </Suspense>
    </>
  );
}

function eventText(event: LeadDetail["events"][number]): string {
  const stage = (value: string | null) => (value && value in LEAD_STAGE_LABELS ? LEAD_STAGE_LABELS[value as LeadStage] : value ?? "-");
  switch (event.type) {
    case "imported":
      return `Imported as ${stage(event.to)}`;
    case "stage_changed":
      return `Stage: ${stage(event.from)} → ${stage(event.to)}`;
    case "contacted":
      return "Marked as contacted";
    case "notes_changed":
      return "Notes changed";
    case "followed_up":
      return "Follow-up sent";
    case "draft_written":
      return event.to === "template" ? "Draft written (template)" : `Draft written (${event.to ?? "AI"})`;
  }
}

async function LeadContent({ params }: Pick<PageProps<"/admin/growth/[id]">, "params">) {
  const [, { id }] = await Promise.all([requireAdmin(), params]);
  if (!isUuid(id)) notFound();
  const detail = await getLead(id);
  if (!detail) notFound();
  const { lead, store, events } = detail;
  const latest = (await latestDrafts([lead._id])).get(lead._id) ?? null;
  const draft = latest ? { firstMessage: latest.firstMessage, followUp: latest.followUp, writer: latest.writer, model: latest.model, note: latest.note } : null;
  const fit = leadFit(lead);
  const link = leadLink(publicEnv.NEXT_PUBLIC_APP_URL, lead.refCode, lead.platform);
  const profile = leadProfileUrl(lead.platform, lead.handle);

  const facts: [string, string][] = [
    ["Platform", LEAD_PLATFORM_LABELS[lead.platform]],
    ["Followers", formatFollowers(lead.followers)],
    ["Course topic", lead.topic ?? "-"],
    ["Current tool", toolText(lead.tool, lead.toolLabel)],
    ["Country", lead.country ?? "-"],
    ["Contact method", lead.contactMethod ?? "-"],
    ["Last contacted", lead.lastContactedAt ? formatDay(lead.lastContactedAt) : "Not yet"],
    ["Imported from", lead.importedFrom ?? "-"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminPageTitle title={lead.name ?? `@${lead.handle}`} description={`@${lead.handle}`} />
        <div className="flex items-center gap-2">
          <StageBadge stage={lead.stage} />
          <ProgressBadge store={store} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-6">
          <Card className="gap-3">
            <h2 className="font-display text-h4">Their link</h2>
            <p className="text-sm text-mute">Put this in your message. When they sign up through it, their store shows on this page by itself.</p>
            <div className="flex items-center gap-2 rounded-md border border-line bg-bg-subtle p-2 pl-3">
              <code className="min-w-0 flex-1 truncate text-sm">{link}</code>
              <CopyButton value={link} label="Copy link" />
            </div>
            {profile && (
              <a href={profile} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-semibold text-blue underline underline-offset-4">
                Open @{lead.handle} on {LEAD_PLATFORM_LABELS[lead.platform]}
                <ExternalLink aria-hidden="true" className="size-4" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </Card>

          <Card className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-h4">Message draft</h2>
              <span className="text-sm text-mute">Fit {fit.score} / 100</span>
            </div>
            {fit.reasons.length > 0 && <p className="text-xs text-mute">{fit.reasons.join(" · ")}</p>}
            {fit.warning && <p className="text-xs text-warning">{fit.warning}</p>}
            {lead.stage === "do_not_contact" ? <p className="text-sm text-mute">This lead is marked do not contact.</p> : <LeadDraft leadId={lead._id} initial={draft} />}
          </Card>

          <Card className="gap-4">
            <h2 className="font-display text-h4">Stage and notes</h2>
            <LeadEditor leadId={lead._id} stage={lead.stage} notes={lead.notes} handle={lead.handle} />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="gap-3">
            <h2 className="font-display text-h4">Their store</h2>
            {store ? (
              <div className="flex flex-col gap-2 text-sm">
                <Link href={`/admin/creators/${store.storeId}`} className="font-semibold text-blue underline underline-offset-4">
                  @{store.slug}
                </Link>
                <span className="text-mute">
                  Signed up {formatDay(store.signedUpAt)} {store.via === "link" ? "through their link" : "(matched by their profile link on the store)"}
                </span>
                <ul className="flex flex-col gap-1">
                  {(
                    [
                      ["Store live", store.steps.published],
                      ["Payments connected", store.steps.paymentConnected],
                      ["First sale", store.steps.firstSale],
                      ["Paid plan", store.steps.paidPlan],
                    ] as const
                  ).map(([label, done]) => (
                    <li key={label} className={done ? "text-ink" : "text-mute"}>
                      {done ? "✓" : "·"} {label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-mute">Not signed up yet.</p>
            )}
          </Card>

          <Card className="gap-3">
            <h2 className="font-display text-h4">Details</h2>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-mute">{label}</dt>
                  <dd className="truncate">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="gap-3">
            <h2 className="font-display text-h4">History</h2>
            {events.length === 0 ? (
              <p className="text-sm text-mute">Nothing yet.</p>
            ) : (
              <ol className="flex flex-col gap-2 text-sm">
                {events.map((event) => (
                  <li key={event._id} className="flex flex-col">
                    <span>{eventText(event)}</span>
                    <span className="text-xs text-mute">
                      {formatDateTime(event.at)} · {event.actor}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
