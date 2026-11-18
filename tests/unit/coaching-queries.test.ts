import { beforeEach, describe, expect, it, vi } from "vitest";

// D-081: the coaching write is scoped to the session owner's store and to coaching products only.

const db = vi.hoisted(() => ({ products: { findOne: vi.fn() } }));
const saveWithSlug = vi.hoisted(() => vi.fn(async () => "saved"));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/products/queries", () => ({ saveWithSlug }));

import { updateCoachingDetails } from "@/lib/coaching/queries";
import { coachingDetailsInputFor } from "@/lib/coaching/schemas";

const input = coachingDetailsInputFor("usd").parse({
  title: "1:1 portfolio review",
  descriptionDoc: null,
  coverUrl: "",
  durationMinutes: 30,
  timeZone: "UTC",
  weekly: [{ day: 1, start: "09:00", end: "12:00" }],
  bufferMinutes: 0,
  minNoticeHours: 12,
  bookingWindowDays: 30,
  meeting: "later",
  meetingUrl: "",
  pricing: "free",
  price: "",
  discountOn: false,
  salePrice: "",
});

beforeEach(() => vi.clearAllMocks());

describe("updateCoachingDetails", () => {
  it("finds and writes only this store's coaching call", async () => {
    db.products.findOne.mockResolvedValue({ status: "draft", slug: "untitled-coaching-call" });
    await expect(updateCoachingDetails("store-1", "call-1", input)).resolves.toBe("saved");
    const filter = { _id: "call-1", storeId: "store-1", type: "coaching", deletedAt: null };
    expect(db.products.findOne.mock.calls[0]?.[0]).toEqual(filter);
    expect(saveWithSlug).toHaveBeenCalledWith(filter, expect.anything(), "1:1 portfolio review", expect.objectContaining({ coaching: input.coaching }));
  });

  it("answers not_found for another store's product or another type, writing nothing", async () => {
    db.products.findOne.mockResolvedValue(null);
    await expect(updateCoachingDetails("store-2", "call-1", input)).resolves.toBe("not_found");
    expect(saveWithSlug).not.toHaveBeenCalled();
  });
});
