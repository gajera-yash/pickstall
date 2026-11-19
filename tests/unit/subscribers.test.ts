import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  orders: { findOne: vi.fn() },
  products: { findOne: vi.fn() },
  subscribers: { updateOne: vi.fn(), find: vi.fn(), countDocuments: vi.fn(), deleteOne: vi.fn(), findOne: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
const welcome = vi.hoisted(() => ({ sendWelcomeEmail: vi.fn(async () => "sent") }));
vi.mock("@/lib/subscribers/welcome", () => welcome);
vi.mock("next/server", () => ({ after: (task: () => unknown) => task() }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: (error: unknown) => (error as { code?: number })?.code === 11000 }));

import { addSubscriberForOrder, deleteSubscriber, listSubscribers, listSubscribersForExport, unsubscribeSubscriber, countSubscribed } from "@/lib/subscribers/queries";
import { consentForCheckout, emailKeyOf, leadMagnetConsentText, purchaseConsentText, subscribersCsv } from "@/lib/subscribers/rules";
import { subscriberLimit } from "@/lib/plans/access";
import { publishProblems } from "@/lib/products/publish";

const consent = { at: new Date("2026-11-19T10:00:00Z"), text: "Email me updates and offers from Asha. I can unsubscribe at any time." };
const paidOrder = (over: Record<string, unknown> = {}) => ({ _id: "order-1", storeId: "store-a", productId: "product-1", buyerEmail: " Asha@Example.com ", buyerName: "Asha", item: { title: "Guide" }, marketingConsent: consent, ...over });

function cursor(docs: unknown[]) {
  const chain = { sort: vi.fn(() => chain), limit: vi.fn(() => chain), toArray: vi.fn(async () => docs) };
  return chain;
}

describe("email list rules (D-094)", () => {
  it("keys emails case-insensitively", () => {
    expect(emailKeyOf("  Asha@Example.COM ")).toBe("asha@example.com");
  });

  it("records consent for a lead magnet always, and for other products only when ticked", () => {
    const now = new Date("2026-11-19T10:00:00Z");
    expect(consentForCheckout("Asha", { type: "lead_magnet", title: "Free guide" }, false, now)).toEqual({ at: now, text: leadMagnetConsentText("Asha", "Free guide") });
    expect(consentForCheckout("Asha", { type: "digital", title: "Guide" }, false, now)).toBeNull();
    expect(consentForCheckout("Asha", { type: "digital", title: "Guide" }, true, now)).toEqual({ at: now, text: purchaseConsentText("Asha") });
  });

  it("says plainly that signing up for a lead magnet includes emails", () => {
    expect(leadMagnetConsentText("Asha", "Free guide")).toMatch(/emails from Asha.*unsubscribe/i);
  });

  it("neutralizes spreadsheet formulas in the CSV export", () => {
    const csv = subscribersCsv([{ email: "a@b.co", name: "=HYPERLINK(\"x\")", status: "subscribed", sourceTitle: "+Guide", joinedAt: new Date("2026-11-19T10:00:00Z") }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"'+Guide"`);
    expect(csv).toContain(`"2026-11-19 10:00:00"`);
  });

  it("uses the plan's subscriber limit, the trial's without a paid plan", () => {
    expect(subscriberLimit({ plan: null })).toBe(1_000);
    expect(subscriberLimit({ plan: "pro" })).toBe(10_000);
  });

  it("never lets a lead magnet be published with a price", () => {
    const base = { title: "Free guide", priceCents: 500, salePriceCents: null, externalUrl: "https://example.com/file", deliveryType: "link" as const, fileId: null };
    expect(publishProblems({ ...base, type: "lead_magnet" }, true)).toContain("A free download can't have a price.");
    expect(publishProblems({ ...base, priceCents: 0, type: "lead_magnet" }, false)).toEqual([]);
  });
});

describe("adding subscribers from paid orders (D-094)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.products.findOne.mockResolvedValue({ type: "lead_magnet", title: "Free guide" });
    db.subscribers.updateOne.mockResolvedValue({});
    db.subscribers.findOne.mockResolvedValue({ _id: "sub-1", welcomedAt: null });
  });

  it("queues the welcome email for someone not yet welcomed, and not again", async () => {
    db.orders.findOne.mockResolvedValue(paidOrder());
    await addSubscriberForOrder("order-1");
    expect(welcome.sendWelcomeEmail).toHaveBeenCalledWith("store-a", "sub-1");
    vi.clearAllMocks();
    db.products.findOne.mockResolvedValue({ type: "lead_magnet", title: "Free guide" });
    db.subscribers.updateOne.mockResolvedValue({});
    db.orders.findOne.mockResolvedValue(paidOrder());
    db.subscribers.findOne.mockResolvedValue({ _id: "sub-1", welcomedAt: new Date() });
    await addSubscriberForOrder("order-1");
    expect(welcome.sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("adds nobody without consent on the order", async () => {
    db.orders.findOne.mockResolvedValue(paidOrder({ marketingConsent: null }));
    expect(await addSubscriberForOrder("order-1")).toBe(false);
    expect(db.subscribers.updateOne).not.toHaveBeenCalled();
  });

  it("only reads a paid order", async () => {
    db.orders.findOne.mockResolvedValue(null);
    expect(await addSubscriberForOrder("order-1")).toBe(false);
    expect(db.orders.findOne).toHaveBeenCalledWith({ _id: "order-1", status: "paid" }, expect.anything());
  });

  it("upserts one entry per store and email, with the consent words and the lead magnet as source", async () => {
    db.orders.findOne.mockResolvedValue(paidOrder());
    expect(await addSubscriberForOrder("order-1")).toBe(true);
    expect(db.products.findOne).toHaveBeenCalledWith({ _id: "product-1", storeId: "store-a" }, expect.anything());
    const [filter, update, options] = db.subscribers.updateOne.mock.calls[0]!;
    expect(filter).toEqual({ storeId: "store-a", emailKey: "asha@example.com" });
    expect(options).toEqual({ upsert: true });
    expect(update.$setOnInsert.unsubscribeToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(update.$setOnInsert).toMatchObject({ email: "Asha@Example.com", name: "Asha", source: { kind: "lead_magnet", productId: "product-1", productTitle: "Free guide" } });
    expect(update.$set).toMatchObject({ status: "subscribed", consent, unsubscribedAt: null });
  });

  it("marks a buyer of another product type as joined at checkout", async () => {
    db.products.findOne.mockResolvedValue({ type: "digital", title: "Guide" });
    db.orders.findOne.mockResolvedValue(paidOrder());
    await addSubscriberForOrder("order-1");
    expect(db.subscribers.updateOne.mock.calls[0]![1].$setOnInsert.source.kind).toBe("purchase");
  });

  it("survives two orders of one email at the same moment", async () => {
    db.orders.findOne.mockResolvedValue(paidOrder());
    db.subscribers.updateOne.mockRejectedValueOnce({ code: 11000 }).mockResolvedValueOnce({});
    expect(await addSubscriberForOrder("order-1")).toBe(true);
    expect(db.subscribers.updateOne).toHaveBeenCalledTimes(2);
    expect(db.subscribers.updateOne.mock.calls[1]![2]).toBeUndefined();
  });
});

describe("the email list is scoped to the session's store (CLAUDE.md 6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists, counts and exports with the store id", async () => {
    db.subscribers.find.mockReturnValue(cursor([]));
    await listSubscribers("store-b", { q: "a.b" });
    expect(db.subscribers.find.mock.calls[0]![0]).toMatchObject({ storeId: "store-b", $or: [{ emailKey: { $regex: "a\\.b" } }, { name: { $regex: "a\\.b", $options: "i" } }] });
    db.subscribers.countDocuments.mockResolvedValue(3);
    expect(await countSubscribed("store-b")).toBe(3);
    expect(db.subscribers.countDocuments).toHaveBeenCalledWith({ storeId: "store-b", status: "subscribed" });
    db.subscribers.find.mockReturnValue(cursor([]));
    await listSubscribersForExport("store-b");
    expect(db.subscribers.find).toHaveBeenLastCalledWith({ storeId: "store-b" });
  });

  it("only changes another store's subscriber when it matches the store id", async () => {
    db.subscribers.updateOne.mockResolvedValue({ matchedCount: 0 });
    expect(await unsubscribeSubscriber("store-b", "sub-a")).toBe(false);
    expect(db.subscribers.updateOne).toHaveBeenCalledWith({ _id: "sub-a", storeId: "store-b" }, expect.anything());
    db.subscribers.deleteOne.mockResolvedValue({ deletedCount: 0 });
    expect(await deleteSubscriber("store-b", "sub-a")).toBe(false);
    expect(db.subscribers.deleteOne).toHaveBeenCalledWith({ _id: "sub-a", storeId: "store-b" });
  });

  it("pages with the last join time", async () => {
    const docs = Array.from({ length: 3 }, (_, i) => ({ _id: `s${i}`, email: `${i}@x.co`, name: null, status: "subscribed", source: { kind: "purchase", productId: "p", productTitle: "P" }, createdAt: new Date(Date.UTC(2026, 10, 19 - i)) }));
    db.subscribers.find.mockReturnValue(cursor(docs));
    const page = await listSubscribers("store-a", { limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.nextBefore).toBe(new Date(Date.UTC(2026, 10, 18)).toISOString());
  });
});
