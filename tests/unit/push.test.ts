import { beforeEach, describe, expect, it, vi } from "vitest";

// D-132: browser push subscriptions, sending, and the push after a new notification.

const db = vi.hoisted(() => {
  const cursor = (rows: unknown[]) => ({ limit: () => ({ toArray: async () => rows }), sort: () => ({ skip: () => ({ toArray: async () => rows }) }) });
  return { cursor, pushSubscriptions: { updateOne: vi.fn(), deleteOne: vi.fn(), deleteMany: vi.fn(), find: vi.fn() }, notifications: { insertOne: vi.fn() } };
});
const webPush = vi.hoisted(() => {
  class WebPushError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
    }
  }
  return { sendNotification: vi.fn(), WebPushError };
});
const env = vi.hoisted(() => ({ publicEnv: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "B".repeat(87) as string | undefined }, serverEnv: { VAPID_PRIVATE_KEY: "p".repeat(43) as string | undefined } }));
vi.mock("server-only", () => ({}));
vi.mock("web-push", () => webPush);
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: (error: unknown) => error instanceof Error && error.message === "dup" }));
vi.mock("@/lib/env", () => ({ publicEnv: env.publicEnv }));
vi.mock("@/lib/env.server", () => ({ serverEnv: env.serverEnv }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { notify } from "@/lib/notifications/queries";
import { deletePushSubscription, endpointId, pushSubscriptionInput, savePushSubscription } from "@/lib/push/queries";
import { safePushHref, sendPushToStore } from "@/lib/push/send";

const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } };

beforeEach(() => {
  vi.clearAllMocks();
  env.publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "B".repeat(87);
  env.serverEnv.VAPID_PRIVATE_KEY = "p".repeat(43);
  db.pushSubscriptions.find.mockReturnValue(db.cursor([]));
  db.pushSubscriptions.updateOne.mockResolvedValue({});
  db.pushSubscriptions.deleteOne.mockResolvedValue({});
  db.notifications.insertOne.mockResolvedValue({});
  webPush.sendNotification.mockResolvedValue({});
});

describe("push subscriptions", () => {
  it("accepts only https push endpoints with proper keys", () => {
    expect(pushSubscriptionInput.safeParse(sub).success).toBe(true);
    expect(pushSubscriptionInput.safeParse({ ...sub, endpoint: "http://evil.test/x" }).success).toBe(false);
    expect(pushSubscriptionInput.safeParse({ ...sub, keys: { p256dh: "<x>", auth: "a" } }).success).toBe(false);
  });

  it("saves one row per browser for the user's store, and removes only the user's own", async () => {
    await savePushSubscription("user-a", "store-a", sub);
    expect(db.pushSubscriptions.updateOne).toHaveBeenCalledWith({ _id: endpointId(sub.endpoint) }, expect.objectContaining({ $set: expect.objectContaining({ userId: "user-a", storeId: "store-a" }) }), { upsert: true });
    await deletePushSubscription("user-a", sub.endpoint);
    expect(db.pushSubscriptions.deleteOne).toHaveBeenCalledWith({ _id: endpointId(sub.endpoint), userId: "user-a" });
  });
});

describe("sending", () => {
  it("sends the notification to the store's browsers and drops the ones that are gone", async () => {
    db.pushSubscriptions.find.mockReturnValue(db.cursor([{ _id: "s1", ...sub }, { _id: "s2", ...sub, endpoint: "https://x.test/gone" }]));
    webPush.sendNotification.mockResolvedValueOnce({}).mockRejectedValueOnce(new webPush.WebPushError("gone", 410));
    expect(await sendPushToStore("store-a", { title: "New sale", body: "$19 Workbook", href: "/dashboard/orders" })).toBe(1);
    expect(db.pushSubscriptions.find).toHaveBeenCalledWith({ storeId: "store-a" });
    const [, payload, options] = webPush.sendNotification.mock.calls[0] ?? [];
    expect(JSON.parse(payload as string)).toEqual({ title: "New sale", body: "$19 Workbook", href: "/dashboard/orders" });
    expect(options).toMatchObject({ vapidDetails: { subject: "mailto:support@pickstall.store" } });
    expect(db.pushSubscriptions.deleteOne).toHaveBeenCalledWith({ _id: "s2", storeId: "store-a" });
  });

  it("does nothing when push is not set up, and opens only dashboard paths", async () => {
    env.serverEnv.VAPID_PRIVATE_KEY = undefined;
    expect(await sendPushToStore("store-a", { title: "x", body: "y", href: "/dashboard" })).toBe(0);
    expect(db.pushSubscriptions.find).not.toHaveBeenCalled();
    expect(safePushHref("https://evil.test")).toBe("/dashboard");
    expect(safePushHref("//evil.test")).toBe("/dashboard");
    expect(safePushHref("/dashboard/orders?status=paid")).toBe("/dashboard/orders?status=paid");
  });
});

describe("notify", () => {
  const note = { storeId: "store-a", kind: "sale" as const, dedupeKey: "order-1", title: "New sale", body: "$19", href: "/dashboard/orders" };

  it("pushes a new notification once, and not a replayed one", async () => {
    db.pushSubscriptions.find.mockReturnValue(db.cursor([{ _id: "s1", ...sub }]));
    await notify(note);
    expect(webPush.sendNotification).toHaveBeenCalledTimes(1);
    db.notifications.insertOne.mockRejectedValueOnce(new Error("dup"));
    await notify(note);
    expect(webPush.sendNotification).toHaveBeenCalledTimes(1);
  });
});
