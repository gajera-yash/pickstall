import { describe, expect, it } from "vitest";

import { buildIcs, foldLine, formatCallTime } from "@/lib/coaching/ics";
import { callText, renderOrderEmail } from "@/lib/email/templates";

// Coaching calls, part K4 (D-084): the calendar file and the booking lines of the buyer's email.

const start = new Date("2026-11-23T04:30:00Z");
const end = new Date("2026-11-23T05:00:00Z");

describe("calendar file", () => {
  const ics = buildIcs({
    uid: "order-1",
    start,
    end,
    title: "Portfolio review with Maya; Studio, Inc",
    description: "Join: https://zoom.us/j/123\nBring your work",
    url: "https://zoom.us/j/123",
    now: new Date("2026-11-18T10:00:00.123Z"),
  });

  it("is a valid VCALENDAR with UTC times and CRLF line ends", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("\r\nDTSTART:20261123T043000Z\r\n");
    expect(ics).toContain("\r\nDTEND:20261123T050000Z\r\n");
    expect(ics).toContain("\r\nDTSTAMP:20261118T100000Z\r\n");
    expect(ics).toContain("\r\nUID:order-1@pickstall\r\n");
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });

  it("escapes text values and keeps the meeting link", () => {
    expect(ics).toContain("SUMMARY:Portfolio review with Maya\\; Studio\\, Inc");
    expect(ics).toContain("DESCRIPTION:Join: https://zoom.us/j/123\\nBring your work");
    expect(ics).toContain("\r\nURL:https://zoom.us/j/123\r\n");
  });

  it("cannot be broken by line breaks or control characters in creator text", () => {
    const evil = buildIcs({ uid: "o", start, end, title: "Call\r\nEND:VEVENT\r\nBEGIN:VEVENT\u0007", description: "", url: null, now: start });
    expect(evil.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
    expect(evil).not.toContain("\u0007");
    expect(evil).not.toContain("URL:");
  });

  it("folds long lines at 75 bytes without splitting a character", () => {
    const line = `SUMMARY:${"é".repeat(60)}`;
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});

describe("call time", () => {
  it("shows the time in the buyer's zone and names the zone", () => {
    expect(formatCallTime(start, end, "Asia/Kolkata")).toMatch(/^Monday, November 23, 2026, 10:00\s*–\s*10:30\sAM \(Asia\/Kolkata\)$/);
    expect(formatCallTime(start, end, "America/New_York")).toContain("(America/New York)");
    expect(formatCallTime(start, end, "Nowhere/Land")).toContain("(UTC)");
  });
});

describe("booking lines in the buyer's email", () => {
  const base = { storeName: "Maya's Studio", vars: { customerName: "Ravi", productTitle: "Portfolio review", accessLink: "https://pickstall.store/welcome/abc" }, subject: null, body: null };

  it("always adds the time and the join link, even with the creator's own message", () => {
    const email = renderOrderEmail({ ...base, body: "Thanks {{customer_name}}!", call: { status: "confirmed", when: "Monday 10:00", meetingUrl: "https://zoom.us/j/1" } });
    expect(email.text).toContain("Your call: Monday 10:00");
    expect(email.text).toContain("https://zoom.us/j/1");
    expect(email.text).toContain("Sent for Maya's Studio through Pickstall");
    expect(email.text).toContain(base.vars.accessLink);
    expect(email.html).toContain('<a href="https://zoom.us/j/1"');
  });

  it("says the coach sends the link, or asks to wait for a new time after a conflict", () => {
    expect(callText({ status: "confirmed", when: "Monday 10:00", meetingUrl: null }, "Maya")).toContain("Maya will email you the meeting link");
    expect(callText({ status: "conflict", when: "Monday 10:00", meetingUrl: null }, "Maya")).toContain("was just taken. Maya will contact you");
  });

  it("escapes the booking lines in HTML", () => {
    const email = renderOrderEmail({ ...base, storeName: "<b>Maya</b>", call: { status: "confirmed", when: "<script>x</script>", meetingUrl: null } });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>Maya</b>");
  });

  it("says a call is booked in the default subject, and leaves other products' emails unchanged", () => {
    expect(renderOrderEmail({ ...base, call: { status: "confirmed", when: "Monday 10:00", meetingUrl: null } }).subject).toBe("Your call is booked: Portfolio review");
    expect(renderOrderEmail(base).subject).toBe("Your order: Portfolio review");
    expect(renderOrderEmail(base).text).not.toContain("Your call");
  });
});
