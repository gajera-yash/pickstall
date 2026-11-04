import { beforeEach, describe, expect, it, vi } from "vitest";

// Course flow G1 (D-054): course writes always filter by the session's store and by type, and a
// new course starts as a lifetime-access draft.

const db = vi.hoisted(() => ({ products: { findOne: vi.fn(), updateOne: vi.fn(), insertOne: vi.fn(), countDocuments: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: () => false }));

import { updateCourseDetails } from "@/lib/courses/queries";
import { createDraftProduct, isUnnamedDraft, updateProduct } from "@/lib/products/queries";

const input = {
  title: "Design basics",
  description: null,
  descriptionDoc: null,
  coverUrl: null,
  priceCents: 2900,
  salePriceCents: null,
  course: { category: "design" as const, tags: [], accessDays: 30 },
};

describe("course queries (ownership)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.products.updateOne.mockResolvedValue({ matchedCount: 1 });
    db.products.countDocuments.mockResolvedValue(0);
  });

  it("saves only a course of the session's store", async () => {
    db.products.findOne.mockResolvedValue({ status: "draft", slug: "untitled-course" });
    expect(await updateCourseDetails("store-1", "c1", input)).toBe("saved");
    expect(db.products.findOne.mock.calls[0]?.[0]).toEqual({ _id: "c1", storeId: "store-1", type: "course", deletedAt: null });
    const [filter, update] = db.products.updateOne.mock.calls[0] ?? [];
    expect(filter).toEqual({ _id: "c1", storeId: "store-1", type: "course", deletedAt: null });
    expect(update).toMatchObject({ $set: { slug: "design-basics", priceCents: 2900, "course.accessDays": 30, "course.category": "design" } });
    expect(update).not.toHaveProperty("$set.course");
  });

  it("returns not_found for another store's course or a digital product", async () => {
    db.products.findOne.mockResolvedValue(null);
    expect(await updateCourseDetails("store-2", "c1", input)).toBe("not_found");
    expect(db.products.updateOne).not.toHaveBeenCalled();
  });

  it("keeps a published course's link stable", async () => {
    db.products.findOne.mockResolvedValue({ status: "published", slug: "old-link" });
    await updateCourseDetails("store-1", "c1", input);
    expect(db.products.updateOne.mock.calls[0]?.[1]).toMatchObject({ $set: { slug: "old-link" } });
  });

  it("never lets the digital editor write a course", async () => {
    db.products.findOne.mockResolvedValue(null);
    await updateProduct("store-1", "c1", {} as Parameters<typeof updateProduct>[2]);
    expect(db.products.findOne.mock.calls[0]?.[0]).toEqual({ _id: "c1", storeId: "store-1", type: { $ne: "course" }, deletedAt: null });
  });

  it("creates a draft course with lifetime access", async () => {
    await createDraftProduct("store-1", { buttonText: "Enroll now", type: "course" });
    expect(db.products.insertOne.mock.calls[0]?.[0]).toMatchObject({
      storeId: "store-1",
      type: "course",
      title: "Untitled course",
      slug: "untitled-course",
      course: { category: null, tags: [], accessDays: null },
    });
    expect(isUnnamedDraft({ status: "draft", title: "Untitled course", type: "course" })).toBe(true);
    expect(isUnnamedDraft({ status: "draft", title: "Untitled course", type: "digital" })).toBe(false);
  });
});
