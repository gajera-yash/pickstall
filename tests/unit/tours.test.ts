import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

// D-128: guided tours, page tours and "New" hotspots, remembered per user.

const db = vi.hoisted(() => ({ tourProgress: { findOne: vi.fn(), updateOne: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));

import { DASHBOARD_SECTIONS } from "@/lib/dashboard/nav";
import { HOTSPOTS, HOTSPOT_IDS, TOURS, TOUR_IDS, isSeenId } from "@/lib/tours/catalog";
import { markTourSeen, resetTours, seenTours } from "@/lib/tours/queries";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("tour catalog", () => {
  it("has short tours and a text for every hotspot", () => {
    for (const id of TOUR_IDS) {
      expect(TOURS[id].length).toBeGreaterThan(0);
      expect(TOURS[id].length).toBeLessThanOrEqual(6);
    }
    for (const id of HOTSPOT_IDS) expect(HOTSPOTS[id].title).toBeTruthy();
    expect(isSeenId("welcome")).toBe(true);
    expect(isSeenId("new-funnels")).toBe(true);
    expect(isSeenId("$where")).toBe(false);
  });

  it("points every step at an element that exists in the code", () => {
    const code = [...sourceFiles("components"), ...sourceFiles("app")].map((file) => readFileSync(file, "utf8")).join("\n");
    const navTargets = new Set(DASHBOARD_SECTIONS.map((section) => `nav-${section.id}`));
    for (const id of TOUR_IDS) {
      for (const step of TOURS[id]) {
        if (navTargets.has(step.target)) continue; // the nav renders data-tour={`nav-${section.id}`}
        expect(code, `data-tour="${step.target}" for tour ${id}`).toContain(`data-tour="${step.target}"`);
      }
      expect(code, `<PageTour id="${id}" /> placed`).toContain(`<PageTour id="${id}"`);
    }
    for (const id of HOTSPOT_IDS) expect(code, `hotspot ${id} placed`).toContain(`"${id}"`);
  });
});

describe("tour progress (only the user's own)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.tourProgress.updateOne.mockResolvedValue({});
  });

  it("reads the user's seen list and drops unknown ids", async () => {
    db.tourProgress.findOne.mockResolvedValue({ seen: ["welcome", "bogus"] });
    expect(await seenTours("user-a")).toEqual(["welcome"]);
    expect(db.tourProgress.findOne.mock.calls[0]?.[0]).toEqual({ _id: "user-a" });
  });

  it("records only known ids, for this user", async () => {
    await markTourSeen("user-a", "store-design");
    expect(db.tourProgress.updateOne).toHaveBeenCalledWith({ _id: "user-a" }, { $addToSet: { seen: "store-design" }, $set: { updatedAt: expect.any(Date) } }, { upsert: true });
    await markTourSeen("user-a", "not-a-tour");
    expect(db.tourProgress.updateOne).toHaveBeenCalledTimes(1);
  });

  it("forgets the tours but keeps the hotspots on reset", async () => {
    await resetTours("user-a", TOUR_IDS);
    expect(db.tourProgress.updateOne).toHaveBeenCalledWith({ _id: "user-a" }, { $pull: { seen: { $in: [...TOUR_IDS] } }, $set: { updatedAt: expect.any(Date) } });
  });
});
