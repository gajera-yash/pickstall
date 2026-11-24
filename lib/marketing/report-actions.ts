"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { logger } from "@/lib/logger";
import { runDailyReport } from "@/lib/marketing/report-send";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { err, ok, type Result } from "@/lib/result";

const MESSAGES = {
  sent: "Report saved, and a preview of the day so far was emailed. Tonight's 21:00 report still comes as usual.",
  already_sent: "Report saved.",
  no_recipient: "Report saved. Set GROWTH_REPORT_EMAIL to get it by email.",
  failed: "Report saved, but the email could not be sent. Check the Resend settings (EMAIL_FROM).",
} as const;

/** Builds today's report so far (D-122), saves it, and emails a preview. Never blocks the 21:00 email. */
export async function sendReportNowAction(): Promise<Result<{ day: string; message: string }>> {
  const admin = await requireAdmin();
  if (!(await takeRateLimit(rateLimitKey("admin-report", admin.id), 10, 60))) return err("Slow down a little, then try again.");
  try {
    const run = await runDailyReport(new Date(), { mode: "preview" });
    revalidatePath("/admin/growth/reports");
    return ok({ day: run.day, message: MESSAGES[run.outcome] });
  } catch (error) {
    logger.error("marketing.report_failed", { name: error instanceof Error ? error.name : undefined });
    return err("Couldn't build the report. Try again.");
  }
}
