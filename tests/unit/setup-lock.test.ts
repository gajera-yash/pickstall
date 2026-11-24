import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSession, redirectOf, storeQueries, userId } from "./auth-mocks";

import { isDashboardUnlocked, isPathOpenWhileLocked, isSectionLocked } from "@/lib/dashboard/setup-lock";
import { DASHBOARD_SECTIONS } from "@/lib/dashboard/nav";

// D-079: the dashboard is locked until setup is done; the guard redirects locked pages to My Store.

const gate = vi.hoisted(() => ({
  loadSetupState: vi.fn(),
  storeHasOrders: vi.fn(),
}));
vi.mock("@/lib/dashboard/setup-state", () => ({ loadSetupState: gate.loadSetupState }));
// storeHasOrders itself (owner filter) is tested in orders-customers.test.ts.
vi.mock("@/lib/orders/creator-queries", () => ({ storeHasOrders: gate.storeHasOrders }));

import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";

const user = { id: userId, email: "maya@example.com" };
const store = { id: "store-1", slug: "maya", name: "Example store", bio: null, avatarUrl: null, stripeChargesEnabled: false, isPublished: false };

function setup(complete: boolean, hasOrders = false) {
  mockSession(user);
  storeQueries.findStoreByOwner.mockResolvedValue(store);
  gate.loadSetupState.mockResolvedValue({ checklist: { complete }, products: [] });
  gate.storeHasOrders.mockResolvedValue(hasOrders);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isDashboardUnlocked", () => {
  it("is locked until setup is complete", () => {
    expect(isDashboardUnlocked({ setupComplete: false, hasOrders: false })).toBe(false);
    expect(isDashboardUnlocked({ setupComplete: true, hasOrders: false })).toBe(true);
  });

  it("stays open for a store that has sold, even if a step is undone later", () => {
    expect(isDashboardUnlocked({ setupComplete: false, hasOrders: true })).toBe(true);
  });
});

describe("isPathOpenWhileLocked", () => {
  it.each(["/dashboard", "/dashboard/", "/dashboard/setup", "/dashboard/setup?step=publish", "/dashboard/products/new", "/dashboard/products/abc-123", "/dashboard/products/abc-123/preview", "/dashboard/settings/account", "/dashboard/settings/plan"])(
    "keeps %s open (My Store, setup, product editor, account, plan)",
    (path) => expect(isPathOpenWhileLocked(path)).toBe(true),
  );

  it.each(["/dashboard/products", "/dashboard/orders", "/dashboard/customers", "/dashboard/income", "/dashboard/marketing", "/dashboard/analytics", "/dashboard/settings", "/dashboard/settings/payments", "/dashboard/products/a/b/c", "/dashboardx", "/dashboard/setupx"])(
    "locks %s",
    (path) => expect(isPathOpenWhileLocked(path)).toBe(false),
  );
});

describe("isSectionLocked", () => {
  it("locks every nav section but My Store while setup is incomplete", () => {
    const locked = DASHBOARD_SECTIONS.filter((section) => isSectionLocked(section.id, false)).map((section) => section.id);
    expect(locked).toEqual(["design", "products", "orders", "customers", "reviews", "income", "marketing", "analytics", "settings"]);
  });

  it("locks nothing once unlocked", () => {
    expect(DASHBOARD_SECTIONS.some((section) => isSectionLocked(section.id, true))).toBe(false);
  });
});

describe("requireUnlockedCreator", () => {
  it("redirects a locked page to My Store while setup is incomplete", async () => {
    setup(false);
    expect(await redirectOf(() => requireUnlockedCreator("/dashboard/orders"))).toBe("/dashboard");
    expect(gate.storeHasOrders).toHaveBeenCalledWith("store-1");
  });

  it("lets the creator in once setup is complete, without checking orders", async () => {
    setup(true);
    await expect(requireUnlockedCreator("/dashboard/orders")).resolves.toEqual({ user, store });
    expect(gate.storeHasOrders).not.toHaveBeenCalled();
  });

  it("lets a store with orders in even when a setup step is open", async () => {
    setup(false, true);
    await expect(requireUnlockedCreator("/dashboard/income")).resolves.toEqual({ user, store });
  });

  it("keeps the pages that setup needs open while locked", async () => {
    setup(false);
    await expect(requireUnlockedCreator("/dashboard/settings/account")).resolves.toEqual({ user, store });
    expect(gate.loadSetupState).not.toHaveBeenCalled();
  });

  it("treats an unreachable orders query as no orders (setup decides)", async () => {
    setup(false);
    gate.storeHasOrders.mockRejectedValue(new Error("db down"));
    expect(await redirectOf(() => requireUnlockedCreator("/dashboard/analytics"))).toBe("/dashboard");
  });

  it("still sends a signed-out visitor to login first", async () => {
    mockSession(null);
    expect(await redirectOf(() => requireUnlockedCreator("/dashboard/orders"))).toBe("/login?next=%2Fdashboard%2Forders");
  });
});
