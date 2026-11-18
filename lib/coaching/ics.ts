// Calendar file (.ics, RFC 5545) for a booked coaching call (D-084). Pure: the email attachment and
// the library's "Add to calendar" download build the same file. All times are UTC ("Z"), so every
// calendar shows the call in its own time zone.

export type CallEvent = {
  /** Stable per booking, so a second download updates the same calendar entry instead of adding one. */
  uid: string;
  start: Date;
  end: Date;
  title: string;
  description: string;
  /** The meeting link, when the coach set one (https only, checked when saved). */
  url: string | null;
  /** When the file was made (DTSTAMP). */
  now: Date;
};

/** 20261123T043000Z */
function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** TEXT values: no control characters, and backslash, semicolon, comma and line breaks escaped. */
function escapeText(value: string): string {
  return (
    value
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r\n|\r|\n/g, "\\n")
  );
}

const encoder = new TextEncoder();

/** Folds a content line at 75 octets (RFC 5545 3.1), never inside a multi-byte character. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(event: CallEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pickstall//Coaching call//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(event.uid)}@pickstall`,
    `DTSTAMP:${utcStamp(event.now)}`,
    `DTSTART:${utcStamp(event.start)}`,
    `DTEND:${utcStamp(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    ...(event.url ? [`LOCATION:${escapeText(event.url)}`, `URL:${event.url.replace(/[\r\n]/g, "")}`] : []),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/**
 * "Monday, November 23, 2026, 10:00 – 10:30 AM (Asia/Kolkata)": the call time in `timeZone`, for
 * emails and the library. Falls back to UTC for an unknown zone.
 */
export function formatCallTime(start: Date, end: Date, timeZone: string | null): string {
  let zone = timeZone || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    zone = "UTC";
  }
  const range = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).formatRange(start, end);
  return `${range} (${zone.replaceAll("_", " ")})`;
}
