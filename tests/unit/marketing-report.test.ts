import { describe, expect, it, vi } from "vitest";

// D-122: the report window (21:00 IST to 21:00 IST), tomorrow's priorities, the email, and the
// admin guard on "Send now".

const guard = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const send = vi.hoisted(() => ({ runDailyReport: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/guard", () => guard);
vi.mock("@/lib/marketing/report-send", () => send);
vi.mock("@/lib/rate-limit", () => ({ rateLimitKey: (...parts: string[]) => parts.join(":"), takeRateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { sendReportNowAction } from "@/lib/marketing/report-actions";
import { renderReportEmail, reportSubject, shortDay } from "@/lib/marketing/report-email";
import { istDate, lastBoundary, reportWindow, tomorrowPriorities } from "@/lib/marketing/report-rules";
import type { DailyReportData } from "@/lib/marketing/report-types";

// 21:00 IST on 24 Nov 2026 is 15:30 UTC.
const AT_2100_IST = new Date("2026-11-24T15:30:00.000Z");

describe("report window", () => {
  it("covers 21:00 IST yesterday to now, labelled with the day it ends on", () => {
    const window = reportWindow(new Date("2026-11-24T15:30:20.000Z"));
    expect(window.start.toISOString()).toBe("2026-11-23T15:30:00.000Z");
    expect(window.day).toBe("2026-11-24");
  });

  it("treats a late cron start (within 15 minutes) as the day that just ended", () => {
    expect(reportWindow(new Date("2026-11-24T15:44:00.000Z")).day).toBe("2026-11-24");
    const after = reportWindow(new Date("2026-11-24T15:50:00.000Z"));
    expect(after.day).toBe("2026-11-25");
    expect(after.start.toISOString()).toBe("2026-11-24T15:30:00.000Z");
  });

  it("a morning run belongs to that day's report", () => {
    const window = reportWindow(new Date("2026-11-24T03:00:00.000Z")); // 08:30 IST
    expect(window.day).toBe("2026-11-24");
    expect(window.start.toISOString()).toBe("2026-11-23T15:30:00.000Z");
  });

  it("finds the latest 21:00 IST and the India date", () => {
    expect(lastBoundary(AT_2100_IST).toISOString()).toBe(AT_2100_IST.toISOString());
    expect(lastBoundary(new Date(AT_2100_IST.getTime() - 1)).toISOString()).toBe("2026-11-23T15:30:00.000Z");
    expect(istDate(new Date("2026-11-24T19:00:00.000Z"))).toBe("2026-11-25"); // 00:30 IST
  });
});

describe("tomorrow's priorities", () => {
  it("puts replies first, then follow-ups, stuck signups and new DMs, at most 3", () => {
    const list = tomorrowPriorities({ repliesWaiting: 2, followUpsDue: 4, stuckSignups: 1, newLeadsLeft: 100, dailyContactTarget: 15 });
    expect(list).toHaveLength(3);
    expect(list[0]).toMatch(/Answer 2 creators who replied/);
    expect(list[1]).toMatch(/Send 4 follow-ups/);
    expect(list[2]).toMatch(/Help 1 creator who signed up but has not/);
  });

  it("asks for more leads when none are left, and caps new DMs at what is left", () => {
    expect(tomorrowPriorities({ repliesWaiting: 0, followUpsDue: 0, stuckSignups: 0, newLeadsLeft: 0, dailyContactTarget: 15 })).toEqual(["Import more creators: no new leads are left to message."]);
    expect(tomorrowPriorities({ repliesWaiting: 0, followUpsDue: 0, stuckSignups: 0, newLeadsLeft: 4, dailyContactTarget: 15 })[0]).toMatch(/Message 4 new creators/);
  });
});

const data: DailyReportData = {
  outreach: { dmsSent: 12, followUpsSent: 3, replies: 1, closed: 0, draftsAi: 10, draftsTemplate: 2, imported: 0 },
  funnel: { signups: 2, signupsBySource: [{ source: "outreach", count: 1 }, { source: "direct", count: 1 }], published: 1, paymentConnected: 0, firstSales: 0, paidPlans: 0 },
  movements: [{ leadId: "l1", who: "Maya <b>Patel</b>", what: "moved to Replied", at: "2026-11-24T10:00:00.000Z" }],
  trend: [{ day: "2026-11-24", dms: 12, replies: 1, signups: 2 }],
  attention: { followUpsDue: 3, repliesWaiting: 1, stuckSignups: 0, aiFallbacks: 2 },
  priorities: ["Answer 1 creator who replied (they wait in Replied)."],
};

describe("report email", () => {
  it("has a short subject and escapes every value", () => {
    expect(shortDay("2026-11-24")).toBe("24 Nov");
    expect(reportSubject("2026-11-24", data)).toBe("Pickstall daily report, 24 Nov: 12 DMs, 1 reply, 2 signups");
    const email = renderReportEmail("2026-11-24", data, "https://pickstall.store/admin/growth/reports/2026-11-24");
    expect(email.html).toContain("Maya &lt;b&gt;Patel&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Patel</b>");
    expect(email.html).not.toContain("${");
    expect(email.html).toContain("border-bottom:1px solid #e5e7eb");
    expect(email.text).toContain("outreach 1, direct 1");
    expect(email.text).toContain("1. Answer 1 creator who replied");
    expect(email.text).toContain("not set up yet");
  });
});

describe("Send now", () => {
  it("needs an admin, and sends a preview", async () => {
    guard.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(sendReportNowAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(send.runDailyReport).not.toHaveBeenCalled();

    guard.requireAdmin.mockResolvedValue({ id: "admin", username: "founder" });
    send.runDailyReport.mockResolvedValue({ day: "2026-11-24", outcome: "sent" });
    expect(await sendReportNowAction()).toMatchObject({ ok: true, data: { day: "2026-11-24" } });
    expect(send.runDailyReport).toHaveBeenCalledWith(expect.any(Date), { mode: "preview" });
  });
});
