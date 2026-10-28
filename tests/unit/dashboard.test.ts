import { describe, expect, it } from "vitest";

import { buildChecklist, type ChecklistInput } from "@/lib/dashboard/checklist";
import { DASHBOARD_SECTIONS, isSectionActive } from "@/lib/dashboard/nav";

const fresh: ChecklistInput = { bio: null, avatarUrl: null, chargesEnabled: false, isPublished: false, productCount: 0 };

describe("dashboard sections (D-011)", () => {
  it("has My Store, Income, Customers and Settings in that order", () => {
    expect(DASHBOARD_SECTIONS.map((section) => section.label)).toEqual(["My Store", "Income", "Customers", "Settings"]);
  });

  it.each([
    ["/dashboard", "/dashboard", true],
    ["/dashboard/products/abc", "/dashboard", true],
    ["/dashboard/store", "/dashboard", true],
    ["/dashboard/income", "/dashboard", false],
    ["/dashboard/income", "/dashboard/income", true],
    ["/dashboard/customers/123", "/dashboard/customers", true],
    ["/dashboard/customersx", "/dashboard/customers", false],
    ["/dashboard", "/dashboard/settings", false],
  ])("%s marks %s active: %s", (pathname, href, expected) => {
    expect(isSectionActive(pathname, href)).toBe(expected);
  });
});

describe("first-run checklist (D-009)", () => {
  it("lists the four steps in order, none done for a new draft store", () => {
    const { items, next, doneCount } = buildChecklist(fresh);
    expect(items.map((item) => item.label)).toEqual(["Store setup", "Add first product", "Connect payments", "Publish"]);
    expect(doneCount).toBe(0);
    expect(next?.id).toBe("store-setup");
  });

  it("counts store setup as done once there is a photo or a bio", () => {
    expect(buildChecklist({ ...fresh, bio: "Hi" }).items[0]?.done).toBe(true);
    expect(buildChecklist({ ...fresh, avatarUrl: "https://example.test/a.png" }).items[0]?.done).toBe(true);
    expect(buildChecklist({ ...fresh, bio: "   " }).items[0]?.done).toBe(false);
  });

  it("points at the first step that is not done", () => {
    const { next, doneCount } = buildChecklist({ ...fresh, bio: "Hi", productCount: 2 });
    expect(next?.id).toBe("connect-payments");
    expect(doneCount).toBe(2);
  });

  it("has no next step when everything is done", () => {
    const all = buildChecklist({ bio: "Hi", avatarUrl: null, chargesEnabled: true, isPublished: true, productCount: 1 });
    expect(all.next).toBeNull();
    expect(all.doneCount).toBe(4);
  });
});
