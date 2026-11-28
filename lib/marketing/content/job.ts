import "server-only";

import { inngest } from "@/lib/inngest/client";
import { writeDayPosts } from "@/lib/marketing/content/posts";
import { istDate } from "@/lib/marketing/report-rules";

/**
 * Every day at 08:00 India time, writes that day's posts for the chosen platforms (D-136). It only
 * fills platforms without a post, so a retry or the founder's earlier click never makes duplicates.
 */
export const dailyContentFunction = inngest.createFunction(
  { id: "growth-daily-content", triggers: [{ cron: "TZ=Asia/Kolkata 0 8 * * *" }] },
  async ({ step }) => {
    const result = await step.run("write-day-posts", () => writeDayPosts(istDate(new Date()), { replace: false }));
    return result;
  },
);
