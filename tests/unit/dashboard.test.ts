import { describe, expect, it } from "vitest";

import { buildChecklist, type ChecklistInput } from "@/lib/dashboard/checklist";
import { dayPart, firstName } from "@/lib/dashboard/greeting";
import { DASHBOARD_SECTIONS, SETTINGS_SECTIONS, breadcrumbFor, isSectionActive, isSettingsSectionActive } from "@/lib/dashboard/nav";

const fresh: ChecklistInput = { bio: null, avatarUrl: null, chargesEnabled: false, isPublished: false, productCount: 0 };

describe("dashboard sections (D-011)", () => {
  it("has the eight sections of the reference design in order", () => {
    expect(DASHBOARD_SECTIONS.map((section) => section.label)).toEqual([
      "My Store",
      "Products",
      "Orders",
      "Customers",
      "Income",
      "Marketing",
      "Analytics",
      "Settings",
    ]);
  });

  it.each([
    ["/dashboard", "/dashboard", true],
    ["/dashboard/products/abc", "/dashboard", false],
    ["/dashboard/products/abc", "/dashboard/products", true],
    ["/dashboard/settings", "/dashboard", false],
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
    expect(items.map((item) => item.label)).toEqual(["Set up your store", "Add your first product", "Connect payments", "Publish your store"]);
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

describe("settings sub-nav and breadcrumb (D-028)", () => {
  it("has Store, Payments and Account, with Store as the Settings root", () => {
    expect(SETTINGS_SECTIONS.map((section) => [section.label, section.href])).toEqual([
      ["Store", "/dashboard/settings"],
      ["Payments", "/dashboard/settings/payments"],
      ["Account", "/dashboard/settings/account"],
    ]);
  });

  it.each([
    ["/dashboard/settings", "/dashboard/settings", true],
    ["/dashboard/settings/payments", "/dashboard/settings", false],
    ["/dashboard/settings/payments", "/dashboard/settings/payments", true],
    ["/dashboard/settings/account", "/dashboard/settings/account", true],
  ])("%s marks %s active: %s", (pathname, href, expected) => {
    expect(isSettingsSectionActive(pathname, href)).toBe(expected);
  });

  it.each([
    ["/dashboard", ["My Store"]],
    ["/dashboard/income", ["Income"]],
    ["/dashboard/settings", ["Settings", "Store"]],
    ["/dashboard/settings/account", ["Settings", "Account"]],
    ["/dashboard/unknown", ["My Store"]],
  ])("breadcrumb for %s", (pathname, labels) => {
    expect(breadcrumbFor(pathname).map((crumb) => crumb.label)).toEqual(labels);
  });

  it("links the checklist steps to the screens that exist", () => {
    const { items } = buildChecklist(fresh);
    expect(items.find((item) => item.id === "store-setup")?.href).toBe("/dashboard/settings");
    expect(items.find((item) => item.id === "connect-payments")?.href).toBe("/dashboard/settings/payments");
  });
});

describe("firstName", () => {
  it.each([
    ["Maya Patel", "Maya"],
    ["  Sam  ", "Sam"],
    ["", null],
    [null, null],
  ])("%s -> %s", (input, expected) => {
    expect(firstName(input)).toBe(expected);
  });
});

describe("dayPart", () => {
  it.each([
    [5, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [16, "afternoon"],
    [17, "evening"],
    [2, "evening"],
  ] as const)("hour %i is %s", (hour, part) => {
    expect(dayPart(hour)).toBe(part);
  });
});
