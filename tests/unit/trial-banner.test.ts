import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { formatPlanDate, TrialBanner } from "@/components/dashboard/trial-banner";
import type { StoreAccess } from "@/lib/plans/access";

const end = new Date("2026-12-15T12:00:00Z");
const render = (access: StoreAccess) => renderToStaticMarkup(createElement(TrialBanner, { access }));

describe("TrialBanner (D-072)", () => {
  it("shows the days left and the end date during the trial, with a link to the plan page", () => {
    const html = render({ state: "trial", endsAt: end, daysLeft: 20 });
    expect(html).toContain("Free trial: 20 days left");
    expect(html).toContain("Dec 15, 2026");
    expect(html).toContain('href="/dashboard/settings/plan"');
  });

  it("says 1 day, not 1 days", () => {
    expect(render({ state: "trial", endsAt: end, daysLeft: 1 })).toContain("1 day left");
  });

  it("explains the pause once the trial has ended", () => {
    const html = render({ state: "paused", endsAt: end, daysLeft: 0 });
    expect(html).toContain("Your free trial has ended");
    expect(html).toContain("Choose a plan to reopen it");
  });

  it("stays quiet for founding creators until their last two weeks", () => {
    expect(render({ state: "founding", endsAt: end, daysLeft: 90 })).toBe("");
    expect(render({ state: "founding", endsAt: end, daysLeft: 10 })).toContain("founding period ends in 10 days");
  });

  it("shows nothing for an older store without a trial date", () => {
    expect(render({ state: "trial", endsAt: null, daysLeft: null })).toBe("");
  });

  it("formats dates the same on server and client (UTC)", () => {
    expect(formatPlanDate(new Date("2026-12-15T23:30:00Z"))).toBe("Dec 15, 2026");
  });
});
