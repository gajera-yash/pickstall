import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSession, rateLimit, userId } from "./auth-mocks";

// D-057: a student's access to a bought course, progress, the mark-complete action, lesson file
// downloads and the library's course entries.

const db = vi.hoisted(() => {
  const coll = () => ({ find: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn() });
  return { orders: coll(), products: coll(), stores: coll(), lessonProgress: coll(), lessons: coll() };
});
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
const player = vi.hoisted(() => ({ loadPlayerCourse: vi.fn(), buildOutline: vi.fn() }));
vi.mock("@/lib/courses/player", () => player);
const files = vi.hoisted(() => ({ openFileForDownload: vi.fn() }));
vi.mock("@/lib/files/product-files", () => files);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { GET } from "@/app/library/[orderId]/files/[fileId]/route";
import { markLessonComplete } from "@/lib/courses/student-actions";
import { completedLessons, courseAccess, setLessonComplete } from "@/lib/courses/student";
import { accessEndsAt } from "@/lib/courses/access";

const ORDER = "11111111-0000-4000-8000-000000000001";
const COURSE = "5b0c6d2e-0000-4000-8000-000000000001";
const LESSON = "bbbbbbbb-0000-4000-8000-000000000001";
const FILE = "ffffffff-0000-4000-8000-000000000001";
const paidAt = new Date("2026-11-01T00:00:00Z");
const order = (over: Record<string, unknown> = {}) => ({ _id: ORDER, productId: COURSE, storeId: "store-1", status: "paid", paidAt, item: { title: "Course" }, ...over });
const course = (over: Record<string, unknown> = {}) => ({ _id: COURSE, type: "course", course: { accessDays: null }, ...over });
const outline = (locked: boolean) => ({ modules: [{ id: "m1", title: "M", unlockDay: locked ? 7 : 0, locked, lessons: [{ id: LESSON, title: "L", hasVideo: false, locked }] }], lessonIds: [LESSON] });

beforeEach(() => {
  vi.clearAllMocks();
  db.orders.findOne.mockResolvedValue(order());
  db.products.findOne.mockResolvedValue(course());
  db.lessonProgress.find.mockReturnValue({ toArray: async () => [] });
  db.lessonProgress.updateOne.mockResolvedValue({});
  db.lessonProgress.deleteOne.mockResolvedValue({});
  mockSession({ id: userId, email: "Student@Example.com" });
  rateLimit.takeRateLimit.mockResolvedValue(true);
  player.loadPlayerCourse.mockResolvedValue({ product: {}, modules: [], lessons: [], files: [{ _id: FILE, lessonId: LESSON }] });
  player.buildOutline.mockReturnValue(outline(false));
});

describe("course access", () => {
  const now = new Date("2026-11-05T00:00:00Z");

  it("finds the order by the signed-in email and the course in the order's own store", async () => {
    expect(await courseAccess(" Student@Example.com ", ORDER, now)).toEqual({ ok: true, orderId: ORDER, storeId: "store-1", courseId: COURSE, enrolledAt: paidAt, expiresAt: null });
    expect(db.orders.findOne.mock.calls[0]?.[0]).toEqual({ _id: ORDER, buyerEmail: "student@example.com" });
    expect(db.products.findOne.mock.calls[0]?.[0]).toEqual({ _id: COURSE, storeId: "store-1" });
  });

  it("refuses another email's order, a refund, an unpaid order and a digital product", async () => {
    db.orders.findOne.mockResolvedValueOnce(null);
    expect(await courseAccess("other@example.com", ORDER, now)).toEqual({ ok: false, reason: "not_found" });
    db.orders.findOne.mockResolvedValueOnce(order({ status: "refunded" }));
    expect(await courseAccess("s@e.co", ORDER, now)).toEqual({ ok: false, reason: "refunded" });
    db.orders.findOne.mockResolvedValueOnce(order({ status: "pending", paidAt: null }));
    expect(await courseAccess("s@e.co", ORDER, now)).toEqual({ ok: false, reason: "not_found" });
    db.products.findOne.mockResolvedValueOnce(course({ type: "digital" }));
    expect(await courseAccess("s@e.co", ORDER, now)).toEqual({ ok: false, reason: "not_course" });
    expect(await courseAccess("s@e.co", "not-a-uuid", now)).toEqual({ ok: false, reason: "not_found" });
  });

  it("ends a limited access period on its day", async () => {
    db.products.findOne.mockResolvedValue(course({ course: { accessDays: 3 } }));
    expect(await courseAccess("s@e.co", ORDER, new Date("2026-11-03T23:59:59Z"))).toMatchObject({ ok: true, expiresAt: new Date("2026-11-04T00:00:00Z") });
    expect(await courseAccess("s@e.co", ORDER, new Date("2026-11-04T00:00:00Z"))).toEqual({ ok: false, reason: "expired" });
    expect(accessEndsAt(paidAt, null)).toBeNull();
  });
});

describe("progress", () => {
  const access = { ok: true as const, orderId: ORDER, storeId: "store-1", courseId: COURSE, enrolledAt: paidAt, expiresAt: null };

  it("marks a lesson once per order, and unmarks only that order's", async () => {
    await setLessonComplete(access, LESSON, true);
    expect(db.lessonProgress.updateOne).toHaveBeenCalledWith({ _id: `${ORDER}:${LESSON}` }, { $setOnInsert: expect.objectContaining({ orderId: ORDER, lessonId: LESSON, productId: COURSE }) }, { upsert: true });
    await setLessonComplete(access, LESSON, false);
    expect(db.lessonProgress.deleteOne).toHaveBeenCalledWith({ _id: `${ORDER}:${LESSON}`, orderId: ORDER });
  });

  it("reads progress by order", async () => {
    db.lessonProgress.find.mockReturnValue({ toArray: async () => [{ lessonId: LESSON }] });
    expect(await completedLessons(ORDER)).toEqual([LESSON]);
    expect(db.lessonProgress.find.mock.calls[0]?.[0]).toEqual({ orderId: ORDER });
  });
});

describe("Mark as complete", () => {
  it("saves for an open lesson of the student's course", async () => {
    expect(await markLessonComplete(ORDER, LESSON, true)).toMatchObject({ ok: true });
    expect(db.lessonProgress.updateOne).toHaveBeenCalled();
    expect(db.orders.findOne.mock.calls[0]?.[0]).toEqual({ _id: ORDER, buyerEmail: "student@example.com" });
  });

  it("refuses a locked lesson, a lesson of another course and an ended access", async () => {
    player.buildOutline.mockReturnValue(outline(true));
    expect(await markLessonComplete(ORDER, LESSON, true)).toMatchObject({ ok: false, error: "This lesson isn't open yet." });
    player.buildOutline.mockReturnValue(outline(false));
    expect(await markLessonComplete(ORDER, "bbbbbbbb-0000-4000-8000-000000000009", true)).toMatchObject({ ok: false });
    db.orders.findOne.mockResolvedValue(order({ status: "refunded" }));
    expect(await markLessonComplete(ORDER, LESSON, true)).toMatchObject({ ok: false });
    expect(db.lessonProgress.updateOne).not.toHaveBeenCalled();
  });
});

describe("lesson file downloads", () => {
  const get = (fileId = FILE) => GET(new Request("http://localhost") as never, { params: Promise.resolve({ orderId: ORDER, fileId }) });

  it("streams the file of an open lesson as an attachment", async () => {
    files.openFileForDownload.mockResolvedValue({ stream: Readable.toWeb(Readable.from(["%PDF-1"])), size: 6, name: "slides.pdf", mime: "application/pdf" });
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(files.openFileForDownload).toHaveBeenCalledWith("store-1", FILE);
  });

  it("refuses a locked lesson's file, a file of another course, no session and an ended access", async () => {
    player.buildOutline.mockReturnValue(outline(true));
    expect((await get()).status).toBe(403);
    player.buildOutline.mockReturnValue(outline(false));
    expect((await get("ffffffff-0000-4000-8000-000000000009")).status).toBe(404);
    db.orders.findOne.mockResolvedValue(order({ status: "refunded" }));
    expect((await get()).status).toBe(403);
    mockSession(null);
    expect((await get()).status).toBe(401);
    expect(files.openFileForDownload).not.toHaveBeenCalled();
  });
});

describe("library entries", () => {
  it("knows courses and their access period, and that an uploaded file counts as available (D-050 fix)", async () => {
    db.orders.find.mockReturnValue({ sort: () => ({ limit: () => ({ toArray: async () => [order(), order({ _id: "o2", productId: "p2" })] }) }) });
    db.stores.find.mockReturnValue({ toArray: async () => [{ _id: "store-1", name: "Maya", slug: "maya" }] });
    db.products.find.mockReturnValue({
      toArray: async () => [
        { _id: COURSE, type: "course", course: { accessDays: 3 } },
        { _id: "p2", type: "digital", deliveryType: "file", fileId: FILE, externalUrl: null },
      ],
    });
    db.lessons.find.mockReturnValue({ toArray: async () => [] });
    // The shared auth mocks replace the library module; this checks the real one.
    const { listPurchases } = await vi.importActual<typeof import("@/lib/library/queries")>("@/lib/library/queries");
    const [first, second] = await listPurchases("s@e.co");
    expect(first).toMatchObject({ kind: "course", available: true, accessEndsAt: new Date("2026-11-04T00:00:00Z"), accessEnded: true });
    expect(second).toMatchObject({ kind: "digital", available: true, accessEndsAt: null, accessEnded: false, progress: null });
  });

  it("counts a course's completed lessons that still exist, through the order's own store (D-070)", async () => {
    db.orders.find.mockReturnValue({ sort: () => ({ limit: () => ({ toArray: async () => [order()] }) }) });
    db.stores.find.mockReturnValue({ toArray: async () => [{ _id: "store-1", name: "Maya", slug: "maya" }] });
    db.products.find.mockReturnValue({ toArray: async () => [{ _id: COURSE, type: "course", course: { accessDays: null } }] });
    db.lessons.find.mockReturnValue({ toArray: async () => [1, 2, 3].map((n) => ({ _id: `l${n}`, storeId: "store-1", productId: COURSE })) });
    // l9 was deleted from the course since; another order's progress is not counted.
    db.lessonProgress.find.mockReturnValue({
      toArray: async () => [
        { orderId: ORDER, lessonId: "l1" },
        { orderId: ORDER, lessonId: "l2" },
        { orderId: ORDER, lessonId: "l9" },
        { orderId: "other", lessonId: "l3" },
      ],
    });
    const { listPurchases } = await vi.importActual<typeof import("@/lib/library/queries")>("@/lib/library/queries");
    const [first] = await listPurchases("s@e.co");
    expect(first?.progress).toEqual({ done: 2, total: 3 });
    expect(db.lessons.find.mock.calls[0]?.[0]).toEqual({ $or: [{ storeId: "store-1", productId: COURSE }] });
    expect(db.lessonProgress.find.mock.calls[0]?.[0]).toEqual({ orderId: { $in: [ORDER] } });
  });
});
