/** First word of a full name for the dashboard greeting ("Welcome, Maya"), or null if there is none. */
export function firstName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

export type DayPart = "morning" | "afternoon" | "evening";

/** Part of the day for the greeting, from the viewer's local hour (0-23). */
export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}
