import { beforeEach, describe, expect, it, vi } from "vitest";

// D-055: curriculum queries always filter by the session's store and course, the layout can only
// reorder this course's own modules and lessons, and the Bunny webhook never undoes "ready".

const db = vi.hoisted(() => {
  const coll = () => ({
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    findOneAndUpdate: vi.fn(),
    insertOne: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    bulkWrite: vi.fn(),
    countDocuments: vi.fn(),
  });
  return { products: coll(), courseModules: coll(), lessons: coll(), files: coll() };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
const bunny = vi.hoisted(() => ({ bunnyConfig: vi.fn(), fetchVideoStatus: vi.fn() }));
vi.mock("@/lib/video/bunny", () => bunny);
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { refreshPendingVideos } from "@/lib/courses/video-status";
import { addLesson, deleteModule, loadCurriculum, saveLayout, setBunnyVideoStatus, setLessonUpload, updateLesson } from "@/lib/courses/curriculum";

const cursor = (rows: unknown[]) => ({ sort: () => ({ toArray: async () => rows }), toArray: async () => rows });
const M1 = "aaaaaaaa-0000-4000-8000-000000000001";
const M2 = "aaaaaaaa-0000-4000-8000-000000000002";
const L1 = "bbbbbbbb-0000-4000-8000-000000000001";
const L2 = "bbbbbbbb-0000-4000-8000-000000000002";
const VIDEO = "eb1c4f77-0cda-46be-b47d-1118ad7c2ffe";

beforeEach(() => {
  vi.clearAllMocks();
  db.products.countDocuments.mockResolvedValue(1);
  db.courseModules.find.mockReturnValue(cursor([{ _id: M1 }, { _id: M2 }]));
  db.lessons.find.mockReturnValue(cursor([{ _id: L1 }, { _id: L2 }]));
  db.files.find.mockReturnValue(cursor([]));
  db.courseModules.bulkWrite.mockResolvedValue({});
  db.lessons.bulkWrite.mockResolvedValue({});
});

describe("loading the curriculum", () => {
  it("is only for a course of the session's store", async () => {
    db.products.countDocuments.mockResolvedValue(0);
    expect(await loadCurriculum("store-2", "course-1")).toBeNull();
    expect(db.products.countDocuments.mock.calls[0]?.[0]).toEqual({ _id: "course-1", storeId: "store-2", type: "course" });
    expect(db.lessons.find).not.toHaveBeenCalled();
  });

  it("filters by store and course, and never shows the Bunny video id", async () => {
    db.courseModules.find.mockReturnValue(cursor([{ _id: M1, title: "Intro", dripDays: null }]));
    db.lessons.find.mockReturnValue(cursor([{ _id: L1, moduleId: M1, title: "Welcome", video: { kind: "bunny", videoId: VIDEO, status: "ready" }, bodyDoc: null, links: [] }]));
    db.files.find.mockReturnValue(cursor([{ _id: "f1", name: "slides.pdf", size: 10, ext: "pdf", lessonId: L1 }]));
    const curriculum = await loadCurriculum("store-1", "course-1");
    expect(db.lessons.find.mock.calls[0]?.[0]).toEqual({ storeId: "store-1", productId: "course-1" });
    expect(db.files.find.mock.calls[0]?.[0]).toMatchObject({ storeId: "store-1", productId: "course-1" });
    expect(curriculum?.modules[0]?.lessons[0]).toMatchObject({ video: { kind: "bunny", status: "ready" }, attachments: [{ id: "f1", label: "PDF" }] });
    expect(JSON.stringify(curriculum)).not.toContain(VIDEO);
  });
});

describe("writes stay inside the course", () => {
  it("adds a lesson only to a module of this course", async () => {
    db.courseModules.countDocuments.mockResolvedValue(0);
    expect(await addLesson("store-1", "course-1", M1, "Lesson")).toBe("not_found");
    expect(db.courseModules.countDocuments.mock.calls[0]?.[0]).toEqual({ _id: M1, storeId: "store-1", productId: "course-1" });
    expect(db.lessons.insertOne).not.toHaveBeenCalled();
  });

  it("updates a lesson with store and course in the filter, and reports the Bunny video it replaced", async () => {
    db.lessons.findOne.mockResolvedValue({ video: { kind: "bunny", videoId: VIDEO, status: "ready" } });
    db.lessons.updateOne.mockResolvedValue({ matchedCount: 1 });
    const result = await updateLesson("store-1", "course-1", L1, { title: "T", bodyDoc: null, links: [], video: { kind: "youtube", id: "dQw4w9WgXcQ" } });
    expect(db.lessons.updateOne.mock.calls[0]?.[0]).toEqual({ _id: L1, storeId: "store-1", productId: "course-1" });
    expect(result).toEqual({ replacedBunnyVideoId: VIDEO });
  });

  it("keeps an uploaded video when the lesson is saved with 'keep'", async () => {
    db.lessons.findOne.mockResolvedValue({ video: { kind: "bunny", videoId: VIDEO, status: "ready" } });
    db.lessons.updateOne.mockResolvedValue({ matchedCount: 1 });
    expect(await updateLesson("store-1", "course-1", L1, { title: "T", bodyDoc: null, links: [], video: "keep" })).toEqual({ replacedBunnyVideoId: null });
    expect(db.lessons.updateOne.mock.calls[0]?.[1]).not.toHaveProperty("$set.video");
  });

  it("points a lesson at a new upload only inside the course", async () => {
    db.lessons.findOneAndUpdate.mockResolvedValue(null);
    expect(await setLessonUpload("store-2", "course-1", L1, VIDEO)).toBe("not_found");
    expect(db.lessons.findOneAndUpdate.mock.calls[0]?.[0]).toEqual({ _id: L1, storeId: "store-2", productId: "course-1" });
  });

  it("deleting a module removes its lessons and returns their Bunny videos", async () => {
    db.courseModules.findOneAndDelete.mockResolvedValue({ _id: M1 });
    db.lessons.find.mockReturnValue(cursor([{ _id: L1, video: { kind: "bunny", videoId: VIDEO, status: "ready" } }, { _id: L2, video: null }]));
    expect(await deleteModule("store-1", "course-1", M1)).toEqual({ bunnyVideoIds: [VIDEO], lessonIds: [L1, L2] });
    expect(db.lessons.deleteMany).toHaveBeenCalledWith({ storeId: "store-1", productId: "course-1", moduleId: M1 });
  });
});

describe("saving the layout", () => {
  const layout = { moduleIds: [M2, M1], lessons: [{ moduleId: M2, lessonIds: [L2, L1] }] };

  it("saves a new order, moving lessons between modules, with store and course in every filter", async () => {
    expect(await saveLayout("store-1", "course-1", layout)).toBe("ok");
    const moduleOps = db.courseModules.bulkWrite.mock.calls[0]?.[0] as { updateOne: { filter: unknown; update: unknown } }[];
    expect(moduleOps[0]?.updateOne).toEqual({ filter: { _id: M2, storeId: "store-1", productId: "course-1" }, update: { $set: { sortOrder: 0, updatedAt: expect.any(Date) } } });
    const lessonOps = db.lessons.bulkWrite.mock.calls[0]?.[0] as { updateOne: { update: { $set: { moduleId: string } } } }[];
    expect(lessonOps.map((op) => op.updateOne.update.$set.moduleId)).toEqual([M2, M2]);
  });

  it.each([
    ["a lesson of another course", { ...layout, lessons: [{ moduleId: M2, lessonIds: [L2, "cccccccc-0000-4000-8000-000000000009"] }] }],
    ["a missing lesson", { ...layout, lessons: [{ moduleId: M2, lessonIds: [L2] }] }],
    ["a lesson twice", { ...layout, lessons: [{ moduleId: M2, lessonIds: [L2, L1] }, { moduleId: M1, lessonIds: [L1] }] }],
    ["a missing module", { ...layout, moduleIds: [M1] }],
    ["a group in an unknown module", { ...layout, lessons: [{ moduleId: "cccccccc-0000-4000-8000-000000000009", lessonIds: [L1, L2] }] }],
  ])("refuses %s", async (_, bad) => {
    expect(await saveLayout("store-1", "course-1", bad)).toBe("not_found");
    expect(db.lessons.bulkWrite).not.toHaveBeenCalled();
  });
});

describe("Bunny status updates", () => {
  it("never moves a ready video back", async () => {
    db.lessons.updateMany.mockResolvedValue({ modifiedCount: 0 });
    await setBunnyVideoStatus(VIDEO, "processing");
    await setBunnyVideoStatus(VIDEO, "failed");
    expect(db.lessons.updateMany.mock.calls[0]?.[0]).toMatchObject({ "video.videoId": VIDEO, "video.status": { $in: ["uploading"] } });
    expect(db.lessons.updateMany.mock.calls[1]?.[0]).toMatchObject({ "video.status": { $in: ["uploading", "processing"] } });
  });
});

describe("asking Bunny about pending videos", () => {
  it("checks only this store's course videos that are still waiting, and saves what Bunny says", async () => {
    bunny.bunnyConfig.mockReturnValue({ libraryId: "759", apiKey: "k", tokenKey: null, readOnlyKey: null });
    bunny.fetchVideoStatus.mockResolvedValue("ready");
    db.lessons.updateMany.mockResolvedValue({ modifiedCount: 1 });
    db.lessons.find.mockReturnValue({ limit: () => ({ toArray: async () => [{ _id: L1, video: { kind: "bunny", videoId: VIDEO, status: "processing" } }] }) });
    await refreshPendingVideos("store-1", "course-1");
    expect(db.lessons.find.mock.calls[0]?.[0]).toEqual({ storeId: "store-1", productId: "course-1", "video.kind": "bunny", "video.status": { $in: ["uploading", "processing"] } });
    expect(bunny.fetchVideoStatus).toHaveBeenCalledWith(expect.anything(), VIDEO);
    expect(db.lessons.updateMany.mock.calls[0]?.[1]).toMatchObject({ $set: { "video.status": "ready" } });
  });

  it("does nothing without Bunny settings", async () => {
    bunny.bunnyConfig.mockReturnValue(null);
    await refreshPendingVideos("store-1", "course-1");
    expect(bunny.fetchVideoStatus).not.toHaveBeenCalled();
  });
});
