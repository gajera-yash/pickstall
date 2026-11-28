import { ArrowLeft, Megaphone } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AdminPageTitle } from "@/components/admin/admin-ui";
import { ContentSettingsForm, PostCard, WriteDayButton, type PostView } from "@/components/admin/growth/content-ui";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin/guard";
import type { MktPostDoc } from "@/lib/db/collections";
import { getContentSettings, postsForDays } from "@/lib/marketing/content/posts";
import { CONTENT_PILLAR_LABELS, CONTENT_PLATFORMS, CONTENT_PLATFORM_LABELS, scheduleForDay, slideCount } from "@/lib/marketing/content/rules";
import { writerStatus } from "@/lib/marketing/drafts";
import { shortDay } from "@/lib/marketing/report-email";
import { DAY_MS, istDate } from "@/lib/marketing/report-rules";

// Content (D-136): today's social posts, one per chosen platform, written at 08:00 IST. The founder
// posts each one from their own account and marks it posted; nothing is published automatically.
export default function GrowthContentPage() {
  return (
    <>
      <Link href="/admin/growth" className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        All leads
      </Link>
      <AdminPageTitle title="Content" description="Today's posts for each platform. Read, copy, download the images, post from your own account, then mark it posted." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <ContentBody />
      </Suspense>
    </>
  );
}

function view(post: MktPostDoc): PostView {
  return {
    id: post._id,
    platform: post.platform,
    pillar: post.pillar,
    topic: post.topic,
    text: post.text,
    title: post.title,
    script: post.script,
    writer: post.writer,
    model: post.model,
    note: post.note,
    status: post.status,
    postedUrl: post.postedUrl,
    imageCount: slideCount(post.platform, post.slides),
    version: post.updatedAt.getTime(),
  };
}

async function ContentBody() {
  await requireAdmin();
  const now = new Date();
  const today = istDate(now);
  const days = Array.from({ length: 7 }, (_, back) => istDate(new Date(now.getTime() - back * DAY_MS)));
  const [settings, posts] = await Promise.all([getContentSettings(), postsForDays(days)]);
  const writer = writerStatus();
  const order = (post: MktPostDoc) => CONTENT_PLATFORMS.indexOf(post.platform);
  const todays = posts.filter((post) => post.day === today).sort((a, b) => order(a) - order(b));
  const plan = scheduleForDay(today);
  const pastDays = days.slice(1);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="today-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="today-title" className="font-display text-h3">
              Today, {shortDay(today)}
            </h2>
            <p className="text-sm text-mute">
              Today&apos;s type: {CONTENT_PILLAR_LABELS[plan.pillar]}. Written by {writer.name === "template" ? "the template (no AI)" : `Groq (${writer.model})`}, every day at 08:00 India time.
            </p>
          </div>
          <WriteDayButton day={today} hasPosts={todays.length > 0} />
        </div>
        {todays.length === 0 ? (
          <EmptyState icon={Megaphone} title="No posts yet today">
            They are written at 08:00 India time. You can write them now with the button above.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {todays.map((post) => (
              <PostCard key={`${post._id}-${post.updatedAt.getTime()}`} post={view(post)} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="week-title" className="flex flex-col gap-3">
        <h2 id="week-title" className="font-display text-h4">
          Last 6 days
        </h2>
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {pastDays.map((day) => {
            const dayPosts = posts.filter((post) => post.day === day).sort((a, b) => order(a) - order(b));
            return (
              <li key={day} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <span className="w-16 font-semibold">{shortDay(day)}</span>
                {dayPosts.length === 0 ? (
                  <span className="text-mute">No posts</span>
                ) : (
                  dayPosts.map((post) => (
                    <Badge key={post._id} variant={post.status === "posted" ? "live" : post.status === "skipped" ? "example" : "draft"}>
                      {CONTENT_PLATFORM_LABELS[post.platform]}: {post.status === "posted" ? "posted" : post.status === "skipped" ? "skipped" : "not posted"}
                    </Badge>
                  ))
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="content-settings-title" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:p-6">
        <h2 id="content-settings-title" className="font-display text-h4">
          Content settings
        </h2>
        <ContentSettingsForm initial={settings} />
      </section>
    </div>
  );
}
