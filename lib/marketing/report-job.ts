import "server-only";

import { inngest } from "@/lib/inngest/client";
import { runDailyReport } from "@/lib/marketing/report-send";

/**
 * Every day at 21:00 India time, builds and saves the growth report and emails it to
 * GROWTH_REPORT_EMAIL (D-122). A retry rebuilds the report but never sends a second email.
 */
export const dailyGrowthReportFunction = inngest.createFunction(
  { id: "growth-daily-report", triggers: [{ cron: "TZ=Asia/Kolkata 0 21 * * *" }] },
  async ({ step }) => {
    const run = await step.run("build-save-email", () => runDailyReport(new Date(), { mode: "scheduled" }));
    return run;
  },
);
