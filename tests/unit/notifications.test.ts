import { beforeEach, describe, expect, it, vi } from "vitest";

// D-061: dashboard notifications are written once per event, never break the caller, and are read
// per store.

const db = vi.hoisted(() => ({
  notifications: { insertOne: vi.fn(), find: vi.fn(), countDocuments: vi.fn(), updateMany: vi.fn() },
  orders: { findOne: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: (error: unknown) => (error as { code?: number })?.code === 11000 }));
const log = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: log }));

import { listNotifications, markAllRead, notify, notifyOrderPaid, notifyRefund } from "@/lib/notifications/queries";
import { timeAgo } from "@/lib/notifications/time";

const order = { _id: "o1", storeId: "store-1", buyerName: "Maya", item: { title: "UI course" }, totalCents: 4900, currency: "usd", provider: "stripe" };

beforeEach(() => {
  vi.clearAllMocks();
  db.notifications.insertOne.mockResolvedValue({});
  db.orders.findOne.mockResolvedValue(order);
});

describe("writing notifications", () => {
  it("makes a 'New sale' for a paid order, linked to that order", async () => {
    await notifyOrderPaid("o1");
    expect(db.orders.findOne.mock.calls[0]?.[0]).toEqual({ _id: "o1", status: "paid" });
    expect(db.notifications.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "store-1", kind: "sale", dedupeKey: "sale:o1", title: "New sale: $49.00", body: "Maya bought UI course", href: "/dashboard/orders?order=o1", readAt: null, test: false }),
    );
  });

  it("calls a free order a sign-up and marks mock orders as tests", async () => {
    db.orders.findOne.mockResolvedValue({ ...order, totalCents: 0, provider: "mock" });
    await notifyOrderPaid("o1");
    expect(db.notifications.insertOne).toHaveBeenCalledWith(expect.objectContaining({ title: "New sign-up", body: "Maya got UI course", test: true }));
  });

  it("keys a refund by its amount, so a partial and a full refund are two notifications", async () => {
    await notifyRefund("o1", 500, false);
    await notifyRefund("o1", 4900, true);
    expect(db.notifications.insertOne.mock.calls.map((call) => (call[0] as { dedupeKey: string; title: string }).dedupeKey)).toEqual(["refund:o1:500", "refund:o1:4900"]);
    expect((db.notifications.insertOne.mock.calls[1]?.[0] as { title: string }).title).toBe("Refunded: $49.00");
  });

  it("ignores a duplicate and never throws on a failed write", async () => {
    db.notifications.insertOne.mockRejectedValueOnce({ code: 11000 });
    await expect(notify({ storeId: "s", kind: "sale", dedupeKey: "k", title: "t", body: "b", href: "/dashboard" })).resolves.toBeUndefined();
    expect(log.warn).not.toHaveBeenCalled();
    db.notifications.insertOne.mockRejectedValueOnce(new Error("db down"));
    await expect(notify({ storeId: "s", kind: "sale", dedupeKey: "k2", title: "t", body: "b", href: "/dashboard" })).resolves.toBeUndefined();
    expect(log.warn).toHaveBeenCalled();
    db.orders.findOne.mockRejectedValueOnce(new Error("db down"));
    await expect(notifyOrderPaid("o1")).resolves.toBeUndefined();
  });
});

describe("reading notifications", () => {
  it("reads and marks read only the store's own", async () => {
    db.notifications.find.mockReturnValue({ sort: () => ({ limit: () => ({ toArray: async () => [{ _id: "n1", kind: "sale", title: "t", body: "b", href: "/dashboard", test: false, createdAt: new Date("2026-11-04T10:00:00Z"), readAt: null }] }) }) });
    db.notifications.countDocuments.mockResolvedValue(1);
    expect(await listNotifications("store-1")).toEqual({ items: [{ id: "n1", kind: "sale", title: "t", body: "b", href: "/dashboard", test: false, createdAt: "2026-11-04T10:00:00.000Z", read: false }], unread: 1 });
    expect(db.notifications.find.mock.calls[0]?.[0]).toEqual({ storeId: "store-1" });
    expect(db.notifications.countDocuments).toHaveBeenCalledWith({ storeId: "store-1", readAt: null });
    await markAllRead("store-1");
    expect(db.notifications.updateMany.mock.calls[0]?.[0]).toEqual({ storeId: "store-1", readAt: null });
  });

  it("says how long ago", () => {
    const now = new Date("2026-11-04T12:00:00Z").getTime();
    expect(timeAgo("2026-11-04T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-11-04T11:55:00Z", now)).toBe("5 min ago");
    expect(timeAgo("2026-11-04T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-11-03T12:00:00Z", now)).toBe("1 day ago");
    expect(timeAgo("2026-11-01T12:00:00Z", now)).toBe("3 days ago");
  });
});
