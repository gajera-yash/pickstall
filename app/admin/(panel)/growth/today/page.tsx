import { ArrowLeft, CalendarCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AdminPageTitle } from "@/components/admin/admin-ui";
import { ContactCard, FollowUpCard, NoReplyCard, WriteAllDrafts } from "@/components/admin/growth/draft-ui";
import { formatDay } from "@/components/dashboard/orders-ui";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin/guard";
import type { DraftView } from "@/lib/marketing/draft-actions";
import { todayQueue, writerStatus, type QueueLead } from "@/lib/marketing/drafts";
import { FOLLOW_UP_AFTER_DAYS } from "@/lib/marketing/growth-settings-rules";
import { leadProfileUrl } from "@/lib/marketing/leads-rules";

// Today (D-121): who to message now. The best-fitting new leads up to the daily target, follow-ups
// that are due, and leads to close after no reply. Messages are sent by hand from the founder's account.
export default function GrowthTodayPage() {
  return (
    <>
      <Link href="/admin/growth" className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        All leads
      </Link>
      <AdminPageTitle title="Today" description="Open the profile, copy the message, send it from your own account, then mark it sent." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <TodayContent />
      </Suspense>
    </>
  );
}

function cardLead(lead: QueueLead) {
  return { id: lead._id, title: lead.name ?? `@${lead.handle}`, handle: lead.handle, profileUrl: leadProfileUrl(lead.platform, lead.handle) };
}

function draftView(lead: QueueLead): DraftView | null {
  if (!lead.draft) return null;
  const { firstMessage, followUp, writer, model, note } = lead.draft;
  return { firstMessage, followUp, writer, model, note };
}

async function TodayContent() {
  await requireAdmin();
  const queue = await todayQueue();
  const writer = writerStatus();
  const { settings } = queue;
  const missingDrafts = queue.toContact.filter((lead) => !lead.draft).map((lead) => lead._id);
  const nothing = queue.toContact.length === 0 && queue.followUps.length === 0 && queue.noReply.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-mute">
        Contacted today: {queue.contactedToday} of {settings.dailyContactTarget}. Drafts today: {queue.draftsToday} of {settings.dailyDraftLimit}, written by {writer.name === "template" ? "the template (no AI)" : `Groq (${writer.model})`}.{" "}
        <Link href="/admin/growth/settings" className="font-semibold text-blue underline underline-offset-4">
          Settings
        </Link>
      </p>

      {nothing && (
        <EmptyState icon={CalendarCheck} title="Nothing to do right now">
          No new leads left for today and no follow-ups due. Import more creators, or come back tomorrow.
        </EmptyState>
      )}

      {queue.toContact.length > 0 && (
        <section aria-labelledby="contact-title" className="flex flex-col gap-3">
          <h2 id="contact-title" className="font-display text-h4">
            Message today ({queue.toContact.length})
          </h2>
          <WriteAllDrafts leadIds={missingDrafts} />
          <ul className="grid gap-3 lg:grid-cols-2">
            {queue.toContact.map((lead) => (
              <ContactCard key={`${lead._id}-${lead.draft?._id ?? "none"}`} lead={cardLead(lead)} fit={lead.fit} initial={draftView(lead)} />
            ))}
          </ul>
        </section>
      )}

      {queue.followUps.length > 0 && (
        <section aria-labelledby="follow-title" className="flex flex-col gap-3">
          <h2 id="follow-title" className="font-display text-h4">
            Follow-ups due ({queue.followUps.length})
          </h2>
          <p className="text-sm text-mute">Messaged {FOLLOW_UP_AFTER_DAYS} or more days ago with no reply. One follow-up only. If they replied, change their stage on their page instead.</p>
          <ul className="grid gap-3 lg:grid-cols-2">
            {queue.followUps.map((lead) => (
              <FollowUpCard key={`${lead._id}-${lead.draft?._id ?? "none"}`} lead={cardLead(lead)} initial={draftView(lead)} contactedOn={lead.lastContactedAt ? formatDay(lead.lastContactedAt) : "-"} />
            ))}
          </ul>
        </section>
      )}

      {queue.noReply.length > 0 && (
        <section aria-labelledby="noreply-title" className="flex flex-col gap-3">
          <h2 id="noreply-title" className="font-display text-h4">
            No reply after the follow-up ({queue.noReply.length})
          </h2>
          <p className="text-sm text-mute">We never message anyone a third time. Close these when you are ready.</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {queue.noReply.map((lead) => (
              <NoReplyCard key={lead._id} lead={cardLead(lead)} followedUpOn={lead.followUpSentAt ? formatDay(lead.followUpSentAt) : "-"} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
