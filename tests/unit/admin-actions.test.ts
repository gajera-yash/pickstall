import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  stores: { findOne: vi.fn(), updateOne: vi.fn() },
  products: { findOneAndUpdate: vi.fn() },
}));
const audit = vi.hoisted(() => ({ recordAudit: vi.fn(async () => undefined) }));
const guard = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/audit/log", () => audit);
vi.mock("@/lib/admin/guard", () => guard);
vi.mock("@/lib/rate-limit", () => ({ rateLimitKey: (...parts: string[]) => parts.join(":"), takeRateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/request-ip", () => ({ getClientIpHash: vi.fn(async () => "iphash") }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { runAdminAction } from "@/lib/admin/actions";
import { extendTrial, grantFounding } from "@/lib/admin/mutations";
import { broadcastProblem } from "@/lib/broadcasts/rules";
import { can, cannotPublishMessage, storeAccess } from "@/lib/plans/access";

const STORE = "11111111-1111-4111-8111-111111111111";
const PRODUCT = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-11-20T10:00:00Z");

describe("a suspended store (D-105)", () => {
  it("cannot sell, publish, use pixels or Pro features, whatever its plan", () => {
    const access = storeAccess({ planTier: "founding", foundingEndsAt: new Date("2027-05-01"), suspendedAt: NOW, billing: undefined }, NOW);
    expect(access.state).toBe("suspended");
    for (const feature of ["sell", "publish", "pixels", "coaching", "automations", "upsells"] as const) expect(can(access, feature)).toBe(false);
    expect(cannotPublishMessage(access)).toMatch(/suspended/);
  });

  it("cannot send broadcasts while blocked", () => {
    expect(broadcastProblem({ subscribed: 10, startedToday: 0, limit: 1000, blocked: true })).toMatch(/turned off/);
  });
});

describe("admin changes (D-105)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("extends a trial from its later end, or from now if it already ended", async () => {
    db.stores.findOne.mockResolvedValue({ trialEndsAt: new Date("2026-11-25T10:00:00Z") });
    expect(await extendTrial(STORE, 7, NOW)).toEqual(new Date("2026-12-02T10:00:00Z"));
    db.stores.findOne.mockResolvedValue({ trialEndsAt: new Date("2026-11-01T10:00:00Z") });
    expect(await extendTrial(STORE, 7, NOW)).toEqual(new Date("2026-11-27T10:00:00Z"));
    db.stores.findOne.mockResolvedValue(null);
    expect(await extendTrial(STORE, 7, NOW)).toBeNull();
  });

  it("grants founding for whole months", async () => {
    db.stores.updateOne.mockResolvedValue({ matchedCount: 1 });
    expect(await grantFounding(STORE, 6, NOW)).toEqual(new Date("2027-05-20T10:00:00Z"));
    expect(db.stores.updateOne).toHaveBeenCalledWith({ _id: STORE }, { $set: expect.objectContaining({ planTier: "founding" }) });
  });
});

describe("admin actions (D-105)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guard.requireAdmin.mockResolvedValue({ id: "admin-1", email: "founder@pickstall.store" });
    db.stores.updateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it("are refused for anyone who is not an admin", async () => {
    guard.requireAdmin.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(runAdminAction({ action: "suspend", storeId: STORE, reason: "spam" })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(db.stores.updateOne).not.toHaveBeenCalled();
  });

  it("need a reason and valid input", async () => {
    expect(await runAdminAction({ action: "suspend", storeId: STORE, reason: " " })).toMatchObject({ ok: false });
    expect(await runAdminAction({ action: "extend_trial", storeId: STORE, days: 500, reason: "help" })).toMatchObject({ ok: false });
    expect(await runAdminAction({ action: "delete_everything", storeId: STORE, reason: "nope" })).toMatchObject({ ok: false });
    expect(db.stores.updateOne).not.toHaveBeenCalled();
  });

  it("suspend a store and record who did it and why, without emails", async () => {
    expect(await runAdminAction({ action: "suspend", storeId: STORE, reason: "Selling <b>stolen</b> courses" })).toEqual({ ok: true, data: { message: "Store suspended." } });
    expect(db.stores.updateOne).toHaveBeenCalledWith({ _id: STORE }, { $set: expect.objectContaining({ suspendReason: "Selling stolen courses" }) });
    expect(audit.recordAudit).toHaveBeenCalledWith({ actorId: "admin-1", action: "admin.store_suspended", storeId: STORE, meta: { reason: "Selling stolen courses" }, ipHash: "iphash" });
    expect(JSON.stringify(audit.recordAudit.mock.calls)).not.toContain("founder@pickstall.store");
  });

  it("unpublish a product and log its store", async () => {
    db.products.findOneAndUpdate.mockResolvedValue({ storeId: STORE });
    expect(await runAdminAction({ action: "unpublish_product", productId: PRODUCT, reason: "DMCA notice" })).toMatchObject({ ok: true });
    expect(db.products.findOneAndUpdate).toHaveBeenCalledWith({ _id: PRODUCT, status: "published" }, { $set: expect.objectContaining({ status: "draft" }) }, expect.anything());
    expect(audit.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.product_unpublished", storeId: STORE, meta: { productId: PRODUCT, reason: "DMCA notice" } }));
  });

  it("block broadcasts", async () => {
    expect(await runAdminAction({ action: "block_broadcasts", storeId: STORE, reason: "complaints" })).toMatchObject({ ok: true });
    expect(db.stores.updateOne).toHaveBeenCalledWith({ _id: STORE }, { $set: expect.objectContaining({ broadcastsBlocked: true }) });
  });
});
