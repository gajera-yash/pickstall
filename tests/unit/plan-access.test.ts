import { describe, expect, it } from "vitest";

import { TRIAL_DAYS } from "@/lib/config";
import { can, storeAccess, trialEndFrom } from "@/lib/plans/access";

const now = new Date("2026-11-15T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

describe("storeAccess", () => {
  it("is a trial with days left, rounded up", () => {
    expect(storeAccess({ planTier: "trial", trialEndsAt: days(10) }, now)).toEqual({ state: "trial", endsAt: days(10), daysLeft: 10 });
    expect(storeAccess({ planTier: "trial", trialEndsAt: days(0.2) }, now).daysLeft).toBe(1);
  });

  it("pauses the store once the trial has ended", () => {
    expect(storeAccess({ planTier: "trial", trialEndsAt: days(-1) }, now)).toMatchObject({ state: "paused", daysLeft: 0 });
    expect(storeAccess({ planTier: "trial", trialEndsAt: now }, now).state).toBe("paused");
  });

  it("a founding grant wins while it lasts, then the trial rules apply again", () => {
    expect(storeAccess({ planTier: "founding", foundingEndsAt: days(150), trialEndsAt: days(-20) }, now)).toMatchObject({ state: "founding", daysLeft: 150 });
    expect(storeAccess({ planTier: "founding", foundingEndsAt: days(-1), trialEndsAt: days(-20) }, now).state).toBe("paused");
  });

  it("keeps an older store without a trial date open until the migration", () => {
    expect(storeAccess({}, now)).toEqual({ state: "trial", endsAt: null, daysLeft: null });
  });

  it("starts a new trial TRIAL_DAYS after creation", () => {
    expect(trialEndFrom(now).getTime() - now.getTime()).toBe(TRIAL_DAYS * 24 * 60 * 60 * 1000);
  });
});

describe("can", () => {
  it("lets a trial or founding store sell and publish, and a paused one neither", () => {
    const open = storeAccess({ planTier: "trial", trialEndsAt: days(3) }, now);
    const paused = storeAccess({ planTier: "trial", trialEndsAt: days(-3) }, now);
    expect(can(open, "sell")).toBe(true);
    expect(can(open, "publish")).toBe(true);
    expect(can(paused, "sell")).toBe(false);
    expect(can(paused, "publish")).toBe(false);
  });
});
