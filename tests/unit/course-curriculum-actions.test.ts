import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSession, rateLimit, storeQueries, userId } from "./auth-mocks";

// D-055: curriculum actions check every input and use the session owner's store only.

const curriculum = vi.hoisted(() => ({
  addLesson: vi.fn(),
  addModule: vi.fn(),
  deleteLesson: vi.fn(),
  deleteModule: vi.fn(),
  loadCurriculum: vi.fn(),
  renameModule: vi.fn(),
  saveLayout: vi.fn(),
  setLessonUpload: vi.fn(),
  updateLesson: vi.fn(),
}));
vi.mock("@/lib/plans/usage", () => ({ countCourses: vi.fn(async () => 0), countPublishedCourses: vi.fn(async () => 0), videoSecondsUsed: vi.fn(async () => 0) }));
vi.mock("@/lib/courses/curriculum", () => curriculum);
vi.mock("@/lib/courses/attachments", () => ({ removeAttachmentsOfLessons: vi.fn(async () => undefined), removeLessonAttachment: vi.fn() }));
const bunny = vi.hoisted(() => ({ bunnyConfig: vi.fn(), createVideo: vi.fn(), deleteVideo: vi.fn(async () => undefined), uploadSignature: vi.fn(() => "sig"), BUNNY_TUS_ENDPOINT: "https://video.bunnycdn.com/tusupload" }));
vi.mock("@/lib/video/bunny", () => bunny);
const videoStatus = vi.hoisted(() => ({ refreshPendingVideos: vi.fn(async () => undefined) }));
vi.mock("@/lib/courses/video-status", () => videoStatus);

import { addCourseModule, getCourseCurriculum, saveCourseLayout, saveCourseLesson, startLessonVideoUpload } from "@/lib/courses/curriculum-actions";

const COURSE = "5b0c6d2e-0000-4000-8000-000000000001";
const LESSON = "bbbbbbbb-0000-4000-8000-000000000001";
const VIDEO = "eb1c4f77-0cda-46be-b47d-1118ad7c2ffe";
const lesson = (overrides: Record<string, unknown> = {}) => JSON.stringify({ title: "Welcome", bodyDoc: null, links: [], videoLink: "keep", ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  mockSession({ id: userId, email: "maya@example.com" });
  storeQueries.findStoreByOwner.mockResolvedValue({ access: { state: "trial", endsAt: null, daysLeft: null, plan: null, cancelsAtPeriodEnd: false }, id: "store-1", slug: "maya", currency: "usd", stripeChargesEnabled: false });
  rateLimit.takeRateLimit.mockResolvedValue(true);
  curriculum.loadCurriculum.mockResolvedValue({ modules: [{ id: "m1", title: "Intro", dripDays: null, lessons: [{ id: LESSON }] }] });
  curriculum.updateLesson.mockResolvedValue({ replacedBunnyVideoId: null });
});

describe("curriculum actions", () => {
  it("adds a module to the session's store, with a cleaned title", async () => {
    curriculum.addModule.mockResolvedValue("ok");
    expect(await addCourseModule(COURSE, "  <b>Intro</b> ")).toMatchObject({ ok: true });
    expect(curriculum.addModule).toHaveBeenCalledWith("store-1", COURSE, "Intro");
    expect(await addCourseModule(COURSE, "   ")).toMatchObject({ ok: false, field: "moduleTitle" });
    expect(await addCourseModule("not-a-uuid", "Intro")).toMatchObject({ ok: false });
  });

  it("saves a YouTube link as its id, and refuses other sites", async () => {
    expect(await saveCourseLesson(COURSE, LESSON, lesson({ videoLink: "https://youtu.be/dQw4w9WgXcQ" }))).toMatchObject({ ok: true });
    expect(curriculum.updateLesson).toHaveBeenCalledWith("store-1", COURSE, LESSON, expect.objectContaining({ video: { kind: "youtube", id: "dQw4w9WgXcQ" } }));
    expect(await saveCourseLesson(COURSE, LESSON, lesson({ videoLink: "https://evil.example/video.mp4" }))).toMatchObject({ ok: false, field: "videoLink" });
    expect(curriculum.updateLesson).toHaveBeenCalledTimes(1);
  });

  it("saves a cleaned quiz, removes it with null, keeps it when left out, and refuses a bad one (D-110)", async () => {
    const quiz = { passPercent: 70, questions: [{ prompt: "<b>Q</b>", options: ["a", "b"], correct: 1 }] };
    expect(await saveCourseLesson(COURSE, LESSON, lesson({ quiz }))).toMatchObject({ ok: true });
    expect(curriculum.updateLesson).toHaveBeenLastCalledWith("store-1", COURSE, LESSON, expect.objectContaining({ quiz: { passPercent: 70, questions: [{ prompt: "Q", options: ["a", "b"], correct: 1 }] } }));
    expect(await saveCourseLesson(COURSE, LESSON, lesson({ quiz: null }))).toMatchObject({ ok: true });
    expect(curriculum.updateLesson).toHaveBeenLastCalledWith("store-1", COURSE, LESSON, expect.objectContaining({ quiz: null }));
    expect(await saveCourseLesson(COURSE, LESSON, lesson())).toMatchObject({ ok: true });
    expect(curriculum.updateLesson).toHaveBeenLastCalledWith("store-1", COURSE, LESSON, expect.objectContaining({ quiz: undefined }));
    expect(await saveCourseLesson(COURSE, LESSON, lesson({ quiz: { ...quiz, passPercent: 20 } }))).toMatchObject({ ok: false, field: "quiz" });
    expect(curriculum.updateLesson).toHaveBeenCalledTimes(3);
  });

  it("removes the video with an empty link, and deletes the Bunny video it replaced", async () => {
    bunny.bunnyConfig.mockReturnValue({ libraryId: "759", apiKey: "k", tokenKey: "t", readOnlyKey: "r" });
    curriculum.updateLesson.mockResolvedValue({ replacedBunnyVideoId: VIDEO });
    await saveCourseLesson(COURSE, LESSON, lesson({ videoLink: "" }));
    expect(curriculum.updateLesson).toHaveBeenCalledWith("store-1", COURSE, LESSON, expect.objectContaining({ video: null }));
    expect(bunny.deleteVideo).toHaveBeenCalledWith(expect.anything(), VIDEO);
  });

  it("accepts only https links on a lesson", async () => {
    expect(await saveCourseLesson(COURSE, LESSON, lesson({ links: [{ label: "Figma", url: "javascript:alert(1)" }] }))).toMatchObject({ ok: false });
    expect(await saveCourseLesson(COURSE, LESSON, lesson({ links: [{ label: "", url: "https://www.figma.com/file/abc" }] }))).toMatchObject({ ok: true });
    expect(curriculum.updateLesson).toHaveBeenLastCalledWith("store-1", COURSE, LESSON, expect.objectContaining({ links: [{ label: "www.figma.com", url: "https://www.figma.com/file/abc" }] }));
  });

  it("refuses a malformed layout before the database", async () => {
    expect(await saveCourseLayout(COURSE, { moduleIds: ["x"], lessons: [] })).toMatchObject({ ok: false });
    expect(curriculum.saveLayout).not.toHaveBeenCalled();
  });

  it("says so when video upload is not set up", async () => {
    bunny.bunnyConfig.mockReturnValue(null);
    expect(await startLessonVideoUpload(COURSE, LESSON, "Welcome")).toMatchObject({ ok: false, error: expect.stringContaining("isn't set up") });
    expect(bunny.createVideo).not.toHaveBeenCalled();
  });

  it("creates the video, points the lesson at it and signs the upload", async () => {
    bunny.bunnyConfig.mockReturnValue({ libraryId: "759", apiKey: "k", tokenKey: "t", readOnlyKey: "r" });
    bunny.createVideo.mockResolvedValue(VIDEO);
    curriculum.setLessonUpload.mockResolvedValue({ replacedBunnyVideoId: null });
    const result = await startLessonVideoUpload(COURSE, LESSON, "Welcome");
    expect(result).toMatchObject({ ok: true, data: { libraryId: "759", videoId: VIDEO, signature: "sig" } });
    expect(curriculum.setLessonUpload).toHaveBeenCalledWith("store-1", COURSE, LESSON, VIDEO);
    expect(JSON.stringify(result)).not.toContain('"k"');
  });

  it("does not start an upload for a lesson outside the course", async () => {
    bunny.bunnyConfig.mockReturnValue({ libraryId: "759", apiKey: "k", tokenKey: "t", readOnlyKey: "r" });
    expect(await startLessonVideoUpload(COURSE, "bbbbbbbb-0000-4000-8000-000000000009", "x")).toMatchObject({ ok: false });
    expect(bunny.createVideo).not.toHaveBeenCalled();
  });

  it("asks Bunny about pending videos when the builder refreshes, for the session's store", async () => {
    expect(await getCourseCurriculum(COURSE)).toMatchObject({ ok: true });
    expect(videoStatus.refreshPendingVideos).toHaveBeenCalledWith("store-1", COURSE);
  });
});
