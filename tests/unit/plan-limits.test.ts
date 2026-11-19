import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ products: { countDocuments: vi.fn() }, lessons: { aggregate: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));

import { PLAN_LIMITS } from "@/lib/config";
import { can, planLimits, planProblem, subscriberLimit, videoHoursProblem, type StoreAccess } from "@/lib/plans/access";
import { countCourses, countPublishedCourses, videoSecondsUsed } from "@/lib/plans/usage";

const access = (state: StoreAccess["state"], plan: StoreAccess["plan"] = null): StoreAccess => ({ state, endsAt: null, daysLeft: null, plan, cancelsAtPeriodEnd: false });

describe("plan limits (D-098)", () => {
  it("gives the free trial and founding creators Pro, and Starter its own limits", () => {
    expect(planLimits(access("trial"))).toBe(PLAN_LIMITS.trial);
    expect(planLimits(access("founding")).maxCourses).toBeNull();
    expect(PLAN_LIMITS.trial).toMatchObject({ maxCourses: PLAN_LIMITS.pro.maxCourses, videoHours: PLAN_LIMITS.pro.videoHours, emailSubscribers: PLAN_LIMITS.pro.emailSubscribers });
    expect(planLimits(access("active", "starter"))).toMatchObject({ maxCourses: 5, videoHours: 20, emailSubscribers: 1000 });
    expect(subscriberLimit(access("active", "starter"))).toBe(1000);
    expect(subscriberLimit(access("trial"))).toBe(10_000);
  });

  it("keeps coaching and automations to Pro (and the trial), never while paused", () => {
    for (const feature of ["coaching", "automations"] as const) {
      expect(can(access("trial"), feature)).toBe(true);
      expect(can(access("founding"), feature)).toBe(true);
      expect(can(access("active", "pro"), feature)).toBe(true);
      expect(can(access("past_due", "pro"), feature)).toBe(true);
      expect(can(access("active", "starter"), feature)).toBe(false);
      expect(can(access("paused"), feature)).toBe(false);
    }
  });

  it("explains what stops a course or a call", () => {
    expect(planProblem(access("active", "starter"), { type: "course", courses: 4 })).toBeNull();
    expect(planProblem(access("active", "starter"), { type: "course", courses: 5 })).toMatch(/allows 5 courses/);
    expect(planProblem(access("active", "pro"), { type: "course", courses: 500 })).toBeNull();
    expect(planProblem(access("active", "starter"), { type: "coaching" })).toMatch(/part of Pro/);
    expect(planProblem(access("trial"), { type: "coaching" })).toBeNull();
    expect(planProblem(access("active", "starter"), { type: "digital" })).toBeNull();
  });

  it("stops new video at the plan's hours", () => {
    expect(videoHoursProblem(access("active", "starter"), 20 * 3600 - 1)).toBeNull();
    expect(videoHoursProblem(access("active", "starter"), 20 * 3600)).toMatch(/20 hours/);
    expect(videoHoursProblem(access("trial"), 20 * 3600)).toBeNull();
  });
});

describe("plan usage is counted for the session's store only (CLAUDE.md 6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts courses and published courses of the store, leaving deleted ones out", async () => {
    db.products.countDocuments.mockResolvedValue(3);
    expect(await countCourses("store-b")).toBe(3);
    expect(db.products.countDocuments).toHaveBeenCalledWith({ storeId: "store-b", type: "course", deletedAt: { $in: [null] } });
    await countPublishedCourses("store-b", "course-1");
    expect(db.products.countDocuments).toHaveBeenLastCalledWith({ storeId: "store-b", type: "course", status: "published", _id: { $ne: "course-1" }, deletedAt: { $in: [null] } });
  });

  it("sums the saved video lengths of the store", async () => {
    db.lessons.aggregate.mockReturnValue({ toArray: async () => [{ total: 5400 }] });
    expect(await videoSecondsUsed("store-b")).toBe(5400);
    expect(db.lessons.aggregate.mock.calls[0]![0][0]).toEqual({ $match: { storeId: "store-b", "video.kind": "bunny" } });
    db.lessons.aggregate.mockReturnValue({ toArray: async () => [] });
    expect(await videoSecondsUsed("store-b")).toBe(0);
  });
});
