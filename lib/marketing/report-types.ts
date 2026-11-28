// The daily growth report's content (D-122), as saved in `mktReports` and shown in the email and
// on the Reports page. Numbers only come from the database; nothing here is written by an AI.

export type ReportOutreach = {
  dmsSent: number;
  followUpsSent: number;
  replies: number;
  closed: number;
  draftsAi: number;
  draftsTemplate: number;
  imported: number;
};

export type ReportFunnel = {
  signups: number;
  signupsBySource: { source: string; count: number }[];
  published: number;
  paymentConnected: number;
  firstSales: number;
  paidPlans: number;
};

export type ReportMovement = { leadId: string; who: string; what: string; at: string };

export type ReportTrendDay = { day: string; dms: number; replies: number; signups: number };

export type ReportAttention = { followUpsDue: number; repliesWaiting: number; stuckSignups: number; aiFallbacks: number };

/** Daily social posts of the report day (D-136): one per chosen platform. */
export type ReportContent = { written: number; posted: number; skipped: number; notPosted: number; postedOn: string[] };

export type DailyReportData = {
  outreach: ReportOutreach;
  funnel: ReportFunnel;
  movements: ReportMovement[];
  trend: ReportTrendDay[];
  attention: ReportAttention;
  priorities: string[];
  /** Missing on reports saved before D-136. */
  content?: ReportContent;
};
