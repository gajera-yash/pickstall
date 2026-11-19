import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  orders: { findOne: vi.fn(), countDocuments: vi.fn(), updateOne: vi.fn(), aggregate: vi.fn() },
  stores: { findOne: vi.fn(), updateOne: vi.fn() },
  products: { findOne: vi.fn() },
  subscribers: { countDocuments: vi.fn() },
}));
const send = vi.hoisted(() => ({ sendListEmails: vi.fn(async () => undefined) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/email/send", () => send);
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_APP_URL: "https://www.pickstall.store" } }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { cartStats, findCartSettings, saveCartSettings, sendCartReminder } from "@/lib/abandoned-cart/queries";
import { DEFAULT_CART_SUBJECT, cartSettingsInput, renderCartReminder } from "@/lib/abandoned-cart/rules";

const NOW = new Date("2026-11-19T12:00:00Z");
const order = { _id: "order-1", storeId: "store-a", productId: "p1", buyerEmail: "asha@example.com", buyerName: "Asha Patel", createdAt: new Date("2026-11-19T09:50:00Z") };
const store = { _id: "store-a", name: "Maya Studio", slug: "maya", abandonedCart: { enabled: true, subject: "", body: "" }, planTier: "founding", foundingEndsAt: new Date("2027-01-01"), trialEndsAt: null, billing: null };

describe("abandoned cart rules (D-096)", () => {
  it("allows only the two variables and keeps text plain", () => {
    expect(cartSettingsInput.safeParse({ enabled: true, subject: "", body: "" }).success).toBe(true);
    expect(cartSettingsInput.safeParse({ enabled: true, subject: "Hi {{customer_name}}", body: "<b>{{product_title}}</b>" })).toMatchObject({ success: true, data: { body: "{{product_title}}" } });
    expect(cartSettingsInput.safeParse({ enabled: true, subject: "{{download_link}}", body: "" }).success).toBe(false);
  });

  it("uses the defaults, fills the first name and product, and always adds the button and the only-reminder line", () => {
    const email = renderCartReminder({ storeName: "Maya Studio", productTitle: "Playbook", buyerName: "Asha Patel", subject: "", body: "Hey {{customer_name}} <script>", checkoutUrl: "https://www.pickstall.store/@maya/playbook/checkout" });
    expect(email.subject).toBe(DEFAULT_CART_SUBJECT.replace("{{product_title}}", "Playbook"));
    expect(email.text).toContain("Hey Asha <script>");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain('href="https://www.pickstall.store/@maya/playbook/checkout"');
    expect(email.text).toContain("You started a checkout at Maya Studio. This is the only reminder you'll get for it.");
  });
});

describe("sending the reminder (D-096)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orders.findOne.mockResolvedValue(order);
    db.stores.findOne.mockResolvedValue(store);
    db.products.findOne.mockResolvedValue({ slug: "playbook", title: "Playbook" });
    db.orders.countDocuments.mockResolvedValue(0);
    db.subscribers.countDocuments.mockResolvedValue(0);
    db.orders.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("claims the order, then sends once with the checkout link", async () => {
    expect(await sendCartReminder("order-1", NOW)).toBe("sent");
    expect(db.orders.findOne).toHaveBeenCalledWith({ _id: "order-1", status: { $in: ["pending", "failed"] }, totalCents: { $gt: 0 }, reminderSentAt: { $in: [null] } }, expect.anything());
    expect(db.orders.updateOne).toHaveBeenCalledWith({ _id: "order-1", status: { $in: ["pending", "failed"] }, reminderSentAt: { $in: [null] } }, { $set: { reminderSentAt: NOW } });
    expect(send.sendListEmails).toHaveBeenCalledWith([expect.objectContaining({ to: "asha@example.com", fromName: "Maya Studio via Pickstall", text: expect.stringContaining("https://www.pickstall.store/@maya/playbook/checkout") })], "cart-order-1");
  });

  it("skips a paid, free or already reminded order", async () => {
    db.orders.findOne.mockResolvedValue(null);
    expect(await sendCartReminder("order-1", NOW)).toBe("skipped");
    expect(send.sendListEmails).not.toHaveBeenCalled();
  });

  it("skips when the store has reminders off or is paused", async () => {
    db.stores.findOne.mockResolvedValue({ ...store, abandonedCart: { enabled: false, subject: "", body: "" } });
    expect(await sendCartReminder("order-1", NOW)).toBe("skipped");
    db.stores.findOne.mockResolvedValue({ ...store, planTier: "standard", foundingEndsAt: null, trialEndsAt: new Date("2026-10-01") });
    expect(await sendCartReminder("order-1", NOW)).toBe("skipped");
    expect(send.sendListEmails).not.toHaveBeenCalled();
  });

  it("skips a buyer who bought it since, was reminded in the last 7 days, or unsubscribed", async () => {
    db.orders.countDocuments.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    expect(await sendCartReminder("order-1", NOW)).toBe("skipped");
    expect(db.orders.countDocuments).toHaveBeenCalledWith({ storeId: "store-a", productId: "p1", buyerEmail: "asha@example.com", status: "paid", createdAt: { $gte: order.createdAt } }, { limit: 1 });
    expect(db.orders.countDocuments).toHaveBeenCalledWith({ storeId: "store-a", productId: "p1", buyerEmail: "asha@example.com", reminderSentAt: { $gte: new Date("2026-11-12T12:00:00Z") } }, { limit: 1 });
    db.orders.countDocuments.mockResolvedValue(0);
    db.subscribers.countDocuments.mockResolvedValue(1);
    expect(await sendCartReminder("order-1", NOW)).toBe("skipped");
    expect(db.subscribers.countDocuments).toHaveBeenCalledWith({ storeId: "store-a", emailKey: "asha@example.com", status: "unsubscribed" }, { limit: 1 });
    expect(send.sendListEmails).not.toHaveBeenCalled();
  });

  it("skips on a plan without automations (D-098)", async () => {
    db.stores.findOne.mockResolvedValue({ ...store, planTier: "standard", foundingEndsAt: null, billing: { plan: "starter", status: "active", currentPeriodEnd: new Date("2026-12-19"), cancelAtPeriodEnd: false } });
    expect(await sendCartReminder("order-1", NOW)).toBe("skipped");
    expect(send.sendListEmails).not.toHaveBeenCalled();
  });

  it("sends nothing when another run claimed the order first", async () => {
    db.orders.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect(await sendCartReminder("order-1", NOW)).toBe("skipped");
    expect(send.sendListEmails).not.toHaveBeenCalled();
  });

  it("never sends for an order bump's own order", async () => {
    db.orders.findOne.mockResolvedValue({ ...order, bumpOf: "order-0" });
    expect(await sendCartReminder("order-1", NOW)).toBe("skipped");
  });
});

describe("settings and stats are scoped to the session's store (CLAUDE.md 6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads and saves only the given store", async () => {
    db.stores.findOne.mockResolvedValue(null);
    expect(await findCartSettings("store-b")).toEqual({ enabled: false, subject: "", body: "" });
    expect(db.stores.findOne).toHaveBeenCalledWith({ _id: "store-b" }, expect.anything());
    await saveCartSettings("store-b", { enabled: true, subject: "", body: "" });
    expect(db.stores.updateOne).toHaveBeenCalledWith({ _id: "store-b" }, { $set: { abandonedCart: { enabled: true, subject: "", body: "" } } });
  });

  it("counts reminders and recoveries of the store only", async () => {
    db.orders.aggregate.mockReturnValue({ toArray: async () => [{ sent: 4, recovered: 1 }] });
    expect(await cartStats("store-b", NOW)).toEqual({ sent: 4, recovered: 1 });
    const pipeline = db.orders.aggregate.mock.calls[0]![0] as { $match?: { storeId?: string } }[];
    expect(pipeline[0]!.$match!.storeId).toBe("store-b");
  });
});
