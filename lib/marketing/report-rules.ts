// The daily growth report (D-122): its time window and tomorrow's priorities. Pure, no database.

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
/** The report closes at 21:00 India time. */
export const REPORT_HOUR_IST = 21;
/** A run this soon after 21:00 still reports the day that just ended (the cron may start a little late). */
const GRACE_MS = 15 * 60 * 1000;

/** The latest 21:00 IST at or before `at`. */
export function lastBoundary(at: Date): Date {
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  const todayAt21 = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), REPORT_HOUR_IST) - IST_OFFSET_MS;
  return new Date(todayAt21 <= at.getTime() ? todayAt21 : todayAt21 - DAY_MS);
}

/** The India date (YYYY-MM-DD) of an instant. */
export function istDate(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export type ReportWindow = { day: string; start: Date; end: Date };

/**
 * The window a report made at `now` covers: from the 21:00 IST before it to `now`. A run within 15
 * minutes after 21:00 still covers the day that just ended. `day` is the India date the window ends on.
 */
export function reportWindow(now: Date): ReportWindow {
  const start = lastBoundary(new Date(now.getTime() - GRACE_MS));
  return { day: istDate(new Date(start.getTime() + DAY_MS)), start, end: now };
}

export type PriorityInput = {
  repliesWaiting: number;
  followUpsDue: number;
  stuckSignups: number;
  newLeadsLeft: number;
  dailyContactTarget: number;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Up to 3 things to do tomorrow, most important first: people who answered, then follow-ups, then new DMs. */
export function tomorrowPriorities(input: PriorityInput): string[] {
  const list: string[] = [];
  if (input.repliesWaiting > 0) list.push(`Answer ${plural(input.repliesWaiting, "creator who replied", "creators who replied")} (they wait in Replied).`);
  if (input.followUpsDue > 0) list.push(`Send ${plural(input.followUpsDue, "follow-up", "follow-ups")} from the Today screen.`);
  if (input.stuckSignups > 0) list.push(`Help ${plural(input.stuckSignups, "creator who signed up but has", "creators who signed up but have")} not published a store yet.`);
  if (input.newLeadsLeft > 0) list.push(`Message ${Math.min(input.dailyContactTarget, input.newLeadsLeft)} new creators from the Today screen.`);
  else list.push("Import more creators: no new leads are left to message.");
  return list.slice(0, 3);
}
