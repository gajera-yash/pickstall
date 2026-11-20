import { beforeEach, describe, expect, it, vi } from "vitest";

// D-117: the "please review" email a week after a purchase, and broadcasts stuck in "sending".

const db = vi.hoisted(() => ({
  orders: { findOne: vi.fn(), updateOne: vi.fn(), countDocuments: vi.fn() },
  stores: { findOne: vi.fn(), updateOne: vi.fn() },
  products: { findOne: vi.fn() },
  reviews: { countDocuments: vi.fn() },
  subscribers: { countDocuments: vi.fn() },
  broadcasts: { updateMany: vi.fn() },
}));
const send = vi.hoisted(() => ({ sendListEmails: vi.fn(async () => undefined) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/email/send", () => send);
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_APP_URL: "https://www.pickstall.store" } }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { failStuckBroadcasts } from "@/lib/broadcasts/queries";
import { findReviewRequestSettings, reviewRequestsSent, saveReviewRequestSettings, sendReviewRequest } from "@/lib/review-request/queries";
import { DEFAULT_REVIEW_SUBJECT, renderReviewRequest, reviewRequestSettingsInput } from "@/lib/review-request/rules";

const NOW = new Date("2026-11-27T12:00:00Z");
const order = { _id: "order-1", storeId: "store-a", productId: "p1", buyerEmail: "asha@example.com", buyerName: "Asha Patel", bumpOf: null };
const store = { _id: "store-a", name: "Maya Studio", reviewRequest: { enabled: true, subject: "", body: "" }, planTier: "founding", foundingEndsAt: new Date("2027-01-01"), trialEndsAt: null, billing: null, suspendedAt: null };

describe("review request rules", () => {
  it("allows only the two variables and keeps text plain", () => {
    expect(reviewRequestSettingsInput.safeParse({ enabled: true, subject: "", body: "" }).success).toBe(true);
    expect(reviewRequestSettingsInput.safeParse({ enabled: true, subject: "Hi {{customer_name}}", body: "<b>{{product_title}}</b>" })).toMatchObject({ success: true, data: { body: "{{product_title}}" } });
    expect(reviewRequestSettingsInput.safeParse({ enabled: true, subject: "{{download_link}}", body: "" }).success).toBe(false);
    expect(reviewRequestSettingsInput.safeParse({ enabled: true, subject: "x".repeat(151), body: "" }).success).toBe(false);
  });

  it("uses the defaults, escapes the text, and always adds the button and the store line", () => {
    const email = renderReviewRequest({ storeName: "Maya Studio", productTitle: "Playbook", buyerName: "Asha Patel", subject: "", body: "Hey {{customer_name}} <script>", reviewUrl: "https://www.pickstall.store/library/order-1" });
    expect(email.subject).toBe(DEFAULT_REVIEW_SUBJECT.replace("{{product_title}}", "Playbook"));
    expect(email.text).toContain("Hey Asha <script>");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain('href="https://www.pickstall.store/library/order-1"');
    expect(email.text).toContain("You bought this from Maya Studio.");
  });
});

describe("sending the review request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.orders.findOne.mockResolvedValue(order);
    db.stores.findOne.mockResolvedValue(store);
    db.products.findOne.mockResolvedValue({ title: "Playbook" });
    db.reviews.countDocuments.mockResolvedValue(0);
    db.subscribers.countDocuments.mockResolvedValue(0);
    db.orders.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("claims the paid order, then sends once with the library link", async () => {
    expect(await sendReviewRequest("order-1", NOW)).toBe("sent");
    expect(db.orders.findOne).toHaveBeenCalledWith({ _id: "order-1", status: "paid", reviewRequestSentAt: { $in: [null] } }, expect.anything());
    expect(db.orders.updateOne).toHaveBeenCalledWith({ _id: "order-1", status: "paid", reviewRequestSentAt: { $in: [null] } }, { $set: { reviewRequestSentAt: NOW } });
    expect(send.sendListEmails).toHaveBeenCalledWith([expect.objectContaining({ to: "asha@example.com", fromName: "Maya Studio via Pickstall", text: expect.stringContaining("https://www.pickstall.store/library/order-1") })], "review-order-1");
  });

  it("skips a refunded, already asked or bump order", async () => {
    db.orders.findOne.mockResolvedValueOnce(null);
    expect(await sendReviewRequest("order-1", NOW)).toBe("skipped");
    db.orders.findOne.mockResolvedValueOnce({ ...order, bumpOf: "order-0" });
    expect(await sendReviewRequest("order-1", NOW)).toBe("skipped");
    expect(send.sendListEmails).not.toHaveBeenCalled();
  });

  it("skips when the store has it off, is suspended or is paused", async () => {
    db.stores.findOne.mockResolvedValueOnce({ ...store, reviewRequest: { enabled: false, subject: "", body: "" } });
    expect(await sendReviewRequest("order-1", NOW)).toBe("skipped");
    db.stores.findOne.mockResolvedValueOnce({ ...store, suspendedAt: new Date("2026-11-20") });
    expect(await sendReviewRequest("order-1", NOW)).toBe("skipped");
    db.stores.findOne.mockResolvedValueOnce({ ...store, planTier: "standard", foundingEndsAt: null, trialEndsAt: new Date("2026-10-01") });
    expect(await sendReviewRequest("order-1", NOW)).toBe("skipped");
    expect(send.sendListEmails).not.toHaveBeenCalled();
  });

  it("skips a deleted product, a buyer who already reviewed, or one who unsubscribed", async () => {
    db.products.findOne.mockResolvedValueOnce(null);
    expect(await sendReviewRequest("order-1", NOW)).toBe("skipped");
    db.reviews.countDocuments.mockResolvedValueOnce(1);
    expect(await sendReviewRequest("order-1", NOW)).toBe("skipped");
    expect(db.reviews.countDocuments).toHaveBeenCalledWith({ storeId: "store-a", productId: "p1", buyerKey: "asha@example.com" }, { limit: 1 });
    db.subscribers.countDocuments.mockResolvedValueOnce(1);
    expect(await sendReviewRequest("order-1", NOW)).toBe("skipped");
    expect(send.sendListEmails).not.toHaveBeenCalled();
  });

  it("sends nothing when another run claimed the order first", async () => {
    db.orders.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect(await sendReviewRequest("order-1", NOW)).toBe("skipped");
    expect(send.sendListEmails).not.toHaveBeenCalled();
  });

  it("reports a failure without throwing", async () => {
    db.orders.findOne.mockRejectedValueOnce(new Error("down"));
    expect(await sendReviewRequest("order-1", NOW)).toBe("failed");
  });
});

describe("review request settings (owner filter)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads, saves and counts only the given store", async () => {
    db.stores.findOne.mockResolvedValue(null);
    expect(await findReviewRequestSettings("store-a")).toEqual({ enabled: false, subject: "", body: "" });
    expect(db.stores.findOne.mock.calls[0]?.[0]).toEqual({ _id: "store-a" });
    await saveReviewRequestSettings("store-a", { enabled: true, subject: "", body: "" });
    expect(db.stores.updateOne).toHaveBeenCalledWith({ _id: "store-a" }, { $set: { reviewRequest: { enabled: true, subject: "", body: "" } } });
    db.orders.countDocuments.mockResolvedValue(4);
    expect(await reviewRequestsSent("store-a", NOW)).toBe(4);
    expect(db.orders.countDocuments.mock.calls[0]?.[0]).toEqual({ storeId: "store-a", reviewRequestSentAt: { $gte: new Date("2026-10-28T12:00:00Z") } });
  });
});

describe("stuck broadcasts", () => {
  it("fails only broadcasts sending with no progress for an hour", async () => {
    db.broadcasts.updateMany.mockResolvedValue({ modifiedCount: 2 });
    expect(await failStuckBroadcasts(NOW)).toBe(2);
    expect(db.broadcasts.updateMany).toHaveBeenCalledWith(
      { status: "sending", updatedAt: { $lt: new Date("2026-11-27T11:00:00Z") } },
      { $set: { status: "failed", updatedAt: NOW, finishedAt: NOW } },
    );
  });
});
