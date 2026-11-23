import "server-only";

import { collections } from "@/lib/db/collections";
import { sendEmail } from "@/lib/email/send";
import { serverEnv } from "@/lib/env.server";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { buildDailyReport } from "@/lib/marketing/report";
import { renderReportEmail } from "@/lib/marketing/report-email";
import { reportWindow } from "@/lib/marketing/report-rules";

// Builds, saves and emails the daily growth report (D-122). Every run rebuilds and saves the day's
// report. The 21:00 IST job sends the day's email once: it claims the send by setting `emailedAt`
// first and releases it if the email fails. The admin "Send now" button sends a preview of the day
// so far and never blocks the 21:00 email.

export type ReportRun = { day: string; outcome: "sent" | "already_sent" | "no_recipient" | "failed" };

export function reportUrl(day: string): string {
  return `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/admin/growth/reports/${day}`;
}

export async function runDailyReport(now: Date = new Date(), options: { mode: "scheduled" | "preview"; recipient?: string | undefined } = { mode: "scheduled" }): Promise<ReportRun> {
  const recipient = "recipient" in options ? options.recipient : serverEnv.GROWTH_REPORT_EMAIL;
  const window = reportWindow(now);
  const data = await buildDailyReport(window);
  const { mktReports } = await collections();
  await mktReports.updateOne({ _id: window.day }, { $set: { windowStart: window.start, windowEnd: window.end, data, builtAt: now } }, { upsert: true });

  if (!recipient) return { day: window.day, outcome: "no_recipient" };
  const email = renderReportEmail(window.day, data, reportUrl(window.day));

  if (options.mode === "preview") {
    try {
      await sendEmail({ to: recipient, ...email, subject: `Preview so far: ${email.subject}`.slice(0, 150) });
      return { day: window.day, outcome: "sent" };
    } catch (error) {
      logger.error("marketing.report_email_failed", { name: error instanceof Error ? error.name : undefined, mode: "preview" });
      return { day: window.day, outcome: "failed" };
    }
  }

  const claimed = await mktReports.findOneAndUpdate({ _id: window.day, emailedAt: { $exists: false } }, { $set: { emailedAt: now } }, { projection: { _id: 1 } });
  if (!claimed) return { day: window.day, outcome: "already_sent" };
  try {
    await sendEmail({ to: recipient, ...email });
    return { day: window.day, outcome: "sent" };
  } catch (error) {
    await mktReports.updateOne({ _id: window.day }, { $unset: { emailedAt: "" } });
    logger.error("marketing.report_email_failed", { name: error instanceof Error ? error.name : undefined, mode: "scheduled" });
    return { day: window.day, outcome: "failed" };
  }
}

export async function listReports(limit = 60) {
  const { mktReports } = await collections();
  return mktReports.find({}, { projection: { _id: 1, windowEnd: 1, emailedAt: 1, "data.outreach": 1, "data.funnel.signups": 1 } }).sort({ _id: -1 }).limit(limit).toArray();
}

export async function getReport(day: string) {
  const { mktReports } = await collections();
  return mktReports.findOne({ _id: day });
}
