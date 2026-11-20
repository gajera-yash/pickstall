import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  orders: { findOne: vi.fn() },
  reviews: { updateOne: vi.fn(), findOne: vi.fn(), find: vi.fn(), aggregate: vi.fn(), deleteOne: vi.fn() },
  products: { find: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: (error: unknown) => (error as { code?: number })?.code === 11000 }));

import { listProductReviews, ratingSummaries } from "@/lib/reviews/public";
import { deleteReview, saveReview, setReviewStatus } from "@/lib/reviews/queries";
import { reviewInput, shortName } from "@/lib/reviews/rules";

const ORDER = "11111111-1111-4111-8111-111111111111";
const cursor = (docs: unknown[]) => {
  const chain = { sort: vi.fn(() => chain), limit: vi.fn(() => chain), toArray: vi.fn(async () => docs) };
  return chain;
};

describe("review rules (D-106)", () => {
  it("needs 1-5 stars and cleans the text of tags and links", () => {
    expect(reviewInput.safeParse({ rating: 0, text: "" }).success).toBe(false);
    expect(reviewInput.safeParse({ rating: 6, text: "" }).success).toBe(false);
    expect(reviewInput.parse({ rating: 5, text: "<b>Great</b> course, see https://spam.example now" })).toEqual({ rating: 5, text: "Great course, see  now" });
    expect(reviewInput.parse({ rating: 4, text: "   " })).toEqual({ rating: 4, text: null });
  });

  it("shows only a first name and last initial, never an email", () => {
    expect(shortName("Asha Patel")).toBe("Asha P.");
    expect(shortName("Asha")).toBe("Asha");
    expect(shortName("  ")).toBe("A buyer");
  });
});

describe("saving a review (D-106)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.reviews.updateOne.mockResolvedValue({});
  });

  it("only for the signed-in buyer's own paid order", async () => {
    db.orders.findOne.mockResolvedValue(null);
    expect(await saveReview("Someone@Else.com", ORDER, { rating: 5, text: null })).toBe("not_found");
    expect(db.orders.findOne).toHaveBeenCalledWith({ _id: ORDER, buyerEmail: "someone@else.com", status: "paid" }, expect.anything());
    expect(db.reviews.updateOne).not.toHaveBeenCalled();
  });

  it("one review per buyer and product, published at once, with the short name", async () => {
    db.orders.findOne.mockResolvedValue({ storeId: "store-a", productId: "p1", buyerName: "Asha Patel" });
    expect(await saveReview("asha@example.com", ORDER, { rating: 4, text: "Good" })).toBe("saved");
    const [filter, update, options] = db.reviews.updateOne.mock.calls[0]!;
    expect(filter).toEqual({ storeId: "store-a", productId: "p1", buyerKey: "asha@example.com" });
    expect(update.$set).toMatchObject({ rating: 4, text: "Good" });
    expect(update.$setOnInsert).toMatchObject({ orderId: ORDER, buyerName: "Asha P.", status: "published" });
    expect(update.$set.status).toBeUndefined(); // a hidden review stays hidden when edited
    expect(options).toEqual({ upsert: true });
  });
});

describe("reviews are scoped (CLAUDE.md 6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("public reads return only published reviews of the store, without emails", async () => {
    db.reviews.find.mockReturnValue(cursor([{ _id: "r1", buyerName: "Asha P.", rating: 5, text: "Great", createdAt: new Date() }]));
    const list = await listProductReviews("store-a", "p1");
    expect(db.reviews.find.mock.calls[0]![0]).toEqual({ storeId: "store-a", productId: "p1", status: "published" });
    expect(db.reviews.find.mock.calls[0]![1].projection).not.toHaveProperty("buyerKey");
    expect(JSON.stringify(list)).not.toContain("@");
    db.reviews.aggregate.mockReturnValue({ toArray: async () => [{ _id: "p1", average: 4.666, count: 3 }] });
    expect((await ratingSummaries("store-a", ["p1"])).get("p1")).toEqual({ average: 4.7, count: 3 });
    expect(db.reviews.aggregate.mock.calls[0]![0][0]).toEqual({ $match: { storeId: "store-a", productId: { $in: ["p1"] }, status: "published" } });
  });

  it("creators change only their own store's reviews", async () => {
    db.reviews.updateOne.mockResolvedValue({ matchedCount: 0 });
    expect(await setReviewStatus("store-b", "r1", "hidden")).toBe(false);
    expect(db.reviews.updateOne).toHaveBeenCalledWith({ _id: "r1", storeId: "store-b" }, expect.anything());
    db.reviews.deleteOne.mockResolvedValue({ deletedCount: 0 });
    expect(await deleteReview("store-b", "r1")).toBe(false);
    expect(db.reviews.deleteOne).toHaveBeenCalledWith({ _id: "r1", storeId: "store-b" });
  });
});
