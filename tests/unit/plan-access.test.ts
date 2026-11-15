import { describe, expect, it } from "vitest";

import { TRIAL_DAYS } from "@/lib/config";
import { can, storeAccess, trialEndFrom } from "@/lib/plans/access";

const now = new Date("2026-11-15T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

describe("storeAccess", () => {
  it("is a trial with days left, rounded up", () => {
    expect(storeAccess({ planTier: "trial", trialEndsAt: days(10) }, now)).toEqual({ state: "trial", endsAt: days(10), daysLeft: 10, plan: null, cancelsAtPeriodEnd: false });
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
    expect(storeAccess({}, now)).toEqual({ state: "trial", endsAt: null, daysLeft: null, plan: null, cancelsAtPeriodEnd: false });
  });

  it("starts a new trial TRIAL_DAYS after creation", () => {
    expect(trialEndFrom(now).getTime() - now.getTime()).toBe(TRIAL_DAYS * 24 * 60 * 60 * 1000);
  });
});

describe("paid plans (D-073)", () => {
  const billing = (status: string, extra: Record<string, unknown> = {}) => ({
    customerId: "cus_1",
    subscriptionId: "sub_1",
    plan: "pro" as const,
    status,
    currentPeriodEnd: days(12),
    cancelAtPeriodEnd: false,
    updatedAt: now,
    ...extra,
  });
  const expiredTrial = { planTier: "trial" as const, trialEndsAt: days(-40) };

  it("an active subscription opens the store, whatever the trial says", () => {
    expect(storeAccess({ ...expiredTrial, billing: billing("active") }, now)).toMatchObject({ state: "active", plan: "pro", daysLeft: 12 });
    expect(storeAccess({ ...expiredTrial, billing: billing("trialing") }, now).state).toBe("active");
  });

  it("keeps the store open while Stripe retries a failed payment", () => {
    const access = storeAccess({ ...expiredTrial, billing: billing("past_due") }, now);
    expect(access.state).toBe("past_due");
    expect(can(access, "sell")).toBe(true);
  });

  it("falls back to the free rules once a subscription has ended or never started", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(storeAccess({ ...expiredTrial, billing: billing(status) }, now).state).toBe("paused");
    }
    expect(storeAccess({ planTier: "trial", trialEndsAt: days(5), billing: billing("canceled") }, now).state).toBe("trial");
  });

  it("reports a cancelled plan that is still running", () => {
    expect(storeAccess({ ...expiredTrial, billing: billing("active", { cancelAtPeriodEnd: true }) }, now)).toMatchObject({ state: "active", cancelsAtPeriodEnd: true });
  });

  it("ignores a subscription without a known plan", () => {
    expect(storeAccess({ ...expiredTrial, billing: billing("active", { plan: null }) }, now).state).toBe("paused");
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
