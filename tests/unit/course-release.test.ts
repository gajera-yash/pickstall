import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSession, rateLimit, storeQueries, userId, OPEN_ACCESS } from "./auth-mocks";

// D-056: drip, the player outline and video links, the public outline, release saving and the
// course publish check.

const env = vi.hoisted(() => ({
  serverEnv: { BUNNY_STREAM_LIBRARY_ID: "759", BUNNY_STREAM_API_KEY: "api", BUNNY_STREAM_TOKEN_KEY: "token-key", BUNNY_STREAM_READONLY_KEY: "ro" } as Record<string, string | undefined>,
}));
vi.mock("@/lib/env.server", () => env);
const db = vi.hoisted(() => {
  const coll = () => ({ find: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(), bulkWrite: vi.fn(), countDocuments: vi.fn() });
  return { products: coll(), courseModules: coll(), lessons: coll(), files: coll(), stores: coll() };
});
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
const productQueries = vi.hoisted(() => ({ findProduct: vi.fn(), setProductStatus: vi.fn(), createDraftProduct: vi.fn(), deleteProduct: vi.fn(), updateProduct: vi.fn(), saveWithSlug: vi.fn() }));
vi.mock("@/lib/products/queries", () => productQueries);
const curriculum = vi.hoisted(() => ({ countLessonsWithContent: vi.fn() }));
vi.mock("@/lib/courses/curriculum", () => curriculum);
vi.mock("@/lib/courses/cleanup", () => ({ removeCourseContent: vi.fn() }));
vi.mock("@/lib/files/product-files", () => ({ removeFilesOfProduct: vi.fn() }));

import { saveCourseCertificate, saveCourseRelease } from "@/lib/courses/actions";
import { isUnlocked, unlockDay, unlockLabel, unlocksAt } from "@/lib/courses/drip";
import { buildOutline, playerLessonOf, playerVideoOf } from "@/lib/courses/player";
import { updateCourseRelease } from "@/lib/courses/queries";
import { changeProductStatus } from "@/lib/products/actions";
import { contentSecurityPolicy } from "@/lib/security/headers";
import { findPublicCurriculum } from "@/lib/stores/public";

const COURSE = "5b0c6d2e-0000-4000-8000-000000000001";
const M1 = "aaaaaaaa-0000-4000-8000-000000000001";
const M2 = "aaaaaaaa-0000-4000-8000-000000000002";
const VIDEO = "eb1c4f77-0cda-46be-b47d-1118ad7c2ffe";
const cursor = (rows: unknown[]) => ({ sort: () => ({ toArray: async () => rows }), toArray: async () => rows });

describe("drip", () => {
  const enrolled = new Date("2026-11-01T10:00:00Z");

  it("opens everything at once when drip is off", () => {
    expect(unlockDay(false, 7)).toBe(0);
    expect(isUnlocked(false, 30, enrolled, enrolled)).toBe(true);
  });

  it("opens a drip module on its day after purchase", () => {
    expect(unlocksAt(true, 7, enrolled)).toEqual(new Date("2026-11-08T10:00:00Z"));
    expect(isUnlocked(true, 7, enrolled, new Date("2026-11-08T09:59:59Z"))).toBe(false);
    expect(isUnlocked(true, 7, enrolled, new Date("2026-11-08T10:00:00Z"))).toBe(true);
    expect(isUnlocked(true, null, enrolled, enrolled)).toBe(true);
    expect(unlockLabel(true, 0)).toBe("Opens right away");
    expect(unlockLabel(true, 1)).toBe("Opens 1 day after purchase");
  });
});

describe("player", () => {
  const course = {
    product: { _id: COURSE, title: "Course", course: { category: null, tags: [], accessDays: null, drip: true } },
    modules: [
      { _id: M1, storeId: "s", productId: COURSE, title: "Intro", sortOrder: 0, dripDays: 0, createdAt: new Date(), updatedAt: new Date() },
      { _id: M2, storeId: "s", productId: COURSE, title: "Deep dive", sortOrder: 1, dripDays: 7, createdAt: new Date(), updatedAt: new Date() },
    ],
    lessons: [
      { _id: "l1", storeId: "s", productId: COURSE, moduleId: M1, title: "Welcome", sortOrder: 0, video: { kind: "youtube" as const, id: "dQw4w9WgXcQ" }, bodyDoc: null, links: [], createdAt: new Date(), updatedAt: new Date() },
      { _id: "l2", storeId: "s", productId: COURSE, moduleId: M2, title: "Week 2", sortOrder: 0, video: null, bodyDoc: null, links: [], createdAt: new Date(), updatedAt: new Date() },
    ],
    files: [],
  };
  const now = new Date("2026-11-03T00:00:00Z");

  it("opens every module in the creator's preview, keeping the day as a label", () => {
    const outline = buildOutline(course, null, now);
    expect(outline.modules.map((item) => [item.locked, item.unlockDay])).toEqual([
      [false, 0],
      [false, 7],
    ]);
    expect(outline.lessonIds).toEqual(["l1", "l2"]);
  });

  it("locks a drip module for a student until its day", () => {
    const outline = buildOutline(course, new Date("2026-11-01T00:00:00Z"), now);
    expect(outline.modules[1]).toMatchObject({ locked: true, lessons: [{ id: "l2", locked: true }] });
    expect(buildOutline(course, new Date("2026-10-01T00:00:00Z"), now).modules[1]?.locked).toBe(false);
  });

  it("gives a ready Bunny video a signed link that expires in an hour, and nothing for others", () => {
    const video = playerVideoOf({ kind: "bunny", videoId: VIDEO, status: "ready" }, now);
    expect(video).toMatchObject({ kind: "embed", provider: "bunny" });
    const url = new URL((video as { url: string }).url);
    expect(url.origin).toBe("https://player.mediadelivery.net");
    expect(Number(url.searchParams.get("expires"))).toBe(now.getTime() / 1000 + 3600);
    expect(playerVideoOf({ kind: "bunny", videoId: VIDEO, status: "processing" }, now)).toEqual({ kind: "processing" });
    expect(playerVideoOf({ kind: "bunny", videoId: VIDEO, status: "failed" }, now)).toEqual({ kind: "unavailable" });
    expect(playerVideoOf(null, now)).toBeNull();
  });

  it("builds a YouTube embed from the id", () => {
    expect(playerLessonOf(course, "l1", now)?.video).toEqual({ kind: "embed", url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0", provider: "youtube" });
    expect(playerLessonOf(course, "missing", now)).toBeNull();
  });
});

describe("public course outline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is only for a published course of the store, and reads titles only", async () => {
    db.products.countDocuments.mockResolvedValue(1);
    db.courseModules.find.mockReturnValue(cursor([{ _id: M1, title: "Intro" }]));
    db.lessons.find.mockReturnValue(cursor([{ _id: "l1", moduleId: M1, title: "Welcome", video: { kind: "youtube" } }]));
    expect(await findPublicCurriculum("store-1", COURSE)).toEqual({ modules: [{ title: "Intro", lessons: [{ title: "Welcome", hasVideo: true }] }] });
    expect(db.products.countDocuments.mock.calls[0]?.[0]).toEqual({ _id: COURSE, storeId: "store-1", type: "course", status: "published" });
    const projection = (db.lessons.find.mock.calls[0]?.[1] as { projection: Record<string, unknown> }).projection;
    expect(Object.keys(projection).sort()).toEqual(["moduleId", "title", "video.kind"]);
  });

  it("shows nothing for a draft course", async () => {
    db.products.countDocuments.mockResolvedValue(0);
    expect(await findPublicCurriculum("store-1", COURSE)).toBeNull();
    expect(db.lessons.find).not.toHaveBeenCalled();
  });
});

describe("saving how lessons open", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    storeQueries.findStoreByOwner.mockResolvedValue({ access: OPEN_ACCESS, id: "store-1", slug: "maya", currency: "usd", stripeChargesEnabled: false });
    rateLimit.takeRateLimit.mockResolvedValue(true);
    db.products.updateOne.mockResolvedValue({ matchedCount: 1 });
    db.courseModules.bulkWrite.mockResolvedValue({});
  });

  it("writes the course and its modules with store and course in every filter", async () => {
    await updateCourseRelease("store-1", COURSE, { drip: true, modules: [{ id: M1, dripDays: 7 }] });
    expect(db.products.updateOne.mock.calls[0]?.[0]).toEqual({ _id: COURSE, storeId: "store-1", type: "course", deletedAt: null });
    expect(db.products.updateOne.mock.calls[0]?.[1]).toMatchObject({ $set: { "course.drip": true } });
    const ops = db.courseModules.bulkWrite.mock.calls[0]?.[0] as { updateOne: { filter: unknown } }[];
    expect(ops[0]?.updateOne.filter).toEqual({ _id: M1, storeId: "store-1", productId: COURSE });
  });

  it("refuses days out of range or not whole", async () => {
    expect(await saveCourseRelease(COURSE, { drip: true, modules: [{ id: M1, dripDays: -1 }] })).toMatchObject({ ok: false });
    expect(await saveCourseRelease(COURSE, { drip: true, modules: [{ id: M1, dripDays: 400 }] })).toMatchObject({ ok: false });
    expect(await saveCourseRelease(COURSE, { drip: true, modules: [{ id: M1, dripDays: 1.5 }] })).toMatchObject({ ok: false });
    expect(await saveCourseRelease(COURSE, { drip: true, modules: [{ id: "x", dripDays: 1 }] })).toMatchObject({ ok: false });
    expect(db.products.updateOne).not.toHaveBeenCalled();
    expect(await saveCourseRelease(COURSE, { drip: false, modules: [] })).toMatchObject({ ok: true });
  });

  it("turns certificates on for the session's own course only (D-111)", async () => {
    expect(await saveCourseCertificate(COURSE, true)).toEqual({ ok: true, data: { enabled: true } });
    expect(db.products.updateOne.mock.calls[0]?.[0]).toEqual({ _id: COURSE, storeId: "store-1", type: "course", deletedAt: null });
    expect(db.products.updateOne.mock.calls[0]?.[1]).toMatchObject({ $set: { "course.certificate": true } });
    expect(await saveCourseCertificate(COURSE, "yes")).toMatchObject({ ok: false });
    expect(await saveCourseCertificate("not-a-uuid", true)).toMatchObject({ ok: false });
    db.products.updateOne.mockResolvedValue({ matchedCount: 0 });
    expect(await saveCourseCertificate(COURSE, false)).toMatchObject({ ok: false });
  });

  it("publishes a course only when it has a lesson with content", async () => {
    productQueries.findProduct.mockResolvedValue({ _id: COURSE, type: "course", title: "Course", priceCents: 0, salePriceCents: null, externalUrl: null, deliveryType: "link", fileId: null });
    productQueries.setProductStatus.mockResolvedValue(true);
    curriculum.countLessonsWithContent.mockResolvedValue(0);
    expect(await changeProductStatus(COURSE, "published")).toMatchObject({ ok: false });
    expect(productQueries.setProductStatus).not.toHaveBeenCalled();
    curriculum.countLessonsWithContent.mockResolvedValue(3);
    expect(await changeProductStatus(COURSE, "published")).toMatchObject({ ok: true });
    expect(curriculum.countLessonsWithContent).toHaveBeenCalledWith("store-1", COURSE);
  });
});

describe("video players in the page CSP", () => {
  it("allows only the three player hosts in frames, and still forbids being framed", () => {
    const policy = contentSecurityPolicy(false);
    expect(policy).toContain("frame-src https://player.mediadelivery.net https://www.youtube-nocookie.com https://player.vimeo.com");
    expect(policy).toContain("frame-ancestors 'none'");
  });
});

