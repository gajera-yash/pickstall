import { CARD_EMAIL_COLORS as C, escapeHtml, type RenderedEmail } from "@/lib/email/templates";
import type { DailyReportData } from "@/lib/marketing/report-types";

// The daily growth report email (D-122): plain text plus simple inline-styled HTML. Every value is
// escaped; lead names are shown as text only.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "24 Nov" from "2026-11-24". */
export function shortDay(day: string): string {
  const [, month, date] = day.split("-");
  return `${Number(date)} ${MONTHS[Number(month) - 1] ?? ""}`.trim();
}

const n = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** The report's sections as label/value rows, shared by text and HTML. */
export function reportRows(data: DailyReportData): { title: string; rows: [string, string][] }[] {
  const { outreach, funnel, attention, content } = data;
  const contentSection: { title: string; rows: [string, string][] }[] = content
    ? [
        {
          title: "Content",
          rows: [
            ["Posts published", `${content.posted} of ${content.written}${content.postedOn.length ? ` (${content.postedOn.join(", ")})` : ""}`],
            ["Not posted yet", String(content.notPosted)],
            ["Skipped", String(content.skipped)],
          ],
        },
      ]
    : [];
  return [
    {
      title: "Outreach",
      rows: [
        ["DMs sent", String(outreach.dmsSent)],
        ["Follow-ups sent", String(outreach.followUpsSent)],
        ["Replies", String(outreach.replies)],
        ["Closed (not interested or do not contact)", String(outreach.closed)],
        ["Drafts written", `${outreach.draftsAi + outreach.draftsTemplate} (${outreach.draftsAi} AI, ${outreach.draftsTemplate} template)`],
        ["Leads imported", String(outreach.imported)],
      ],
    },
    {
      title: "Creators",
      rows: [
        ["New signups", `${funnel.signups}${funnel.signupsBySource.length ? ` (${funnel.signupsBySource.map((row) => `${row.source} ${row.count}`).join(", ")})` : ""}`],
        ["Stores published", String(funnel.published)],
        ["PayPal connected", String(funnel.paymentConnected)],
        ["First sales", String(funnel.firstSales)],
        ["Paid plans started", String(funnel.paidPlans)],
      ],
    },
    ...contentSection,
    {
      title: "Needs attention",
      rows: [
        ["Follow-ups due", String(attention.followUpsDue)],
        ["Replies waiting over a day", String(attention.repliesWaiting)],
        ["Signed up, no store published (last 14 days)", String(attention.stuckSignups)],
        ["Drafts where the AI was not used", String(attention.aiFallbacks)],
      ],
    },
  ];
}

export function reportSubject(day: string, data: DailyReportData): string {
  const { outreach, funnel } = data;
  return `Pickstall daily report, ${shortDay(day)}: ${n(outreach.dmsSent, "DM", "DMs")}, ${n(outreach.replies, "reply", "replies")}, ${n(funnel.signups, "signup", "signups")}`;
}

const NOT_YET = "Website visits are not in this report yet (PostHog comes later).";

export function renderReportEmail(day: string, data: DailyReportData, reportUrl: string): RenderedEmail {
  const sections = reportRows(data);
  const text = [
    reportSubject(day, data),
    "",
    "Tomorrow:",
    ...data.priorities.map((item, index) => `${index + 1}. ${item}`),
    "",
    ...sections.flatMap((section) => [section.title, ...section.rows.map(([label, value]) => `- ${label}: ${value}`), ""]),
    "Who moved:",
    ...(data.movements.length ? data.movements.map((row) => `- ${row.who}: ${row.what}`) : ["- Nobody yet."]),
    "",
    "Last 7 days (DMs / replies / signups):",
    ...data.trend.map((row) => `- ${shortDay(row.day)}: ${row.dms} / ${row.replies} / ${row.signups}`),
    "",
    NOT_YET,
    `Full report: ${reportUrl}`,
  ].join("\n");

  const td = `padding:6px 0;border-bottom:1px solid ${C.border};font-size:14px`;
  const sectionHtml = sections
    .map(
      (section) =>
        `<h2 style="margin:22px 0 6px;font-size:15px">${escapeHtml(section.title)}</h2><table role="presentation" style="width:100%;border-collapse:collapse">${section.rows
          .map(([label, value]) => `<tr><td style="${td};color:${C.muted}">${escapeHtml(label)}</td><td style="${td};text-align:right;font-weight:700">${escapeHtml(value)}</td></tr>`)
          .join("")}</table>`,
    )
    .join("");
  const movements = data.movements.length
    ? `<ul style="margin:0;padding-left:18px">${data.movements.map((row) => `<li style="margin:0 0 4px;font-size:14px"><strong>${escapeHtml(row.who)}</strong>: ${escapeHtml(row.what)}</li>`).join("")}</ul>`
    : `<p style="margin:0;font-size:14px;color:${C.muted}">Nobody yet.</p>`;
  const trend = `<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="${td};color:${C.muted}">Day</td><td style="${td};text-align:right;color:${C.muted}">DMs</td><td style="${td};text-align:right;color:${C.muted}">Replies</td><td style="${td};text-align:right;color:${C.muted}">Signups</td></tr>${data.trend
    .map((row) => `<tr><td style="${td}">${escapeHtml(shortDay(row.day))}</td><td style="${td};text-align:right">${row.dms}</td><td style="${td};text-align:right">${row.replies}</td><td style="${td};text-align:right">${row.signups}</td></tr>`)
    .join("")}</table>`;
  const priorities = `<ol style="margin:0;padding-left:20px">${data.priorities.map((item) => `<li style="margin:0 0 6px;font-size:15px">${escapeHtml(item)}</li>`).join("")}</ol>`;

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:${C.page};font-family:Arial,Helvetica,sans-serif;color:${C.text}"><div style="max-width:560px;margin:0 auto;background:${C.card};border-radius:12px;padding:28px"><p style="margin:0 0 4px;font-weight:700">Pickstall daily report</p><p style="margin:0 0 18px;color:${C.muted};font-size:13px">${escapeHtml(shortDay(day))}, 21:00 IST</p><h2 style="margin:0 0 8px;font-size:15px">Tomorrow</h2>${priorities}${sectionHtml}<h2 style="margin:22px 0 6px;font-size:15px">Who moved</h2>${movements}<h2 style="margin:22px 0 6px;font-size:15px">Last 7 days</h2>${trend}<p style="margin:22px 0 0;color:${C.muted};font-size:13px;line-height:1.5">${escapeHtml(NOT_YET)}</p><p style="margin:16px 0 0"><a href="${escapeHtml(reportUrl)}" style="display:inline-block;background:${C.button};color:${C.onButton};text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">Open the full report</a></p></div></body></html>`;

  return { subject: reportSubject(day, data).replace(/[\r\n]+/g, " ").slice(0, 150), text, html };
}
