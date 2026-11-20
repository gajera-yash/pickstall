import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSession, rateLimit, userId } from "./auth-mocks";

// D-110: lesson quiz rules, grading on the server, saved scores and "complete only after passing".

const db = vi.hoisted(() => {
  const coll = () => ({ find: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn() });
  return { orders: coll(), products: coll(), lessonProgress: coll(), quizAttempts: coll() };
});
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
const player = vi.hoisted(() => ({ loadPlayerCourse: vi.fn(), buildOutline: vi.fn() }));
vi.mock("@/lib/courses/player", () => player);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { gradeQuiz, quizInput, studentQuizOf, type LessonQuiz } from "@/lib/courses/quiz";
import { markLessonComplete, submitLessonQuiz } from "@/lib/courses/student-actions";

const ORDER = "11111111-0000-4000-8000-000000000001";
const COURSE = "5b0c6d2e-0000-4000-8000-000000000001";
const LESSON = "bbbbbbbb-0000-4000-8000-000000000001";
const paidAt = new Date("2026-11-01T00:00:00Z");

const QUIZ: LessonQuiz = {
  passPercent: 70,
  questions: [
    { prompt: "2 + 2?", options: ["3", "4"], correct: 1 },
    { prompt: "Sky?", options: ["Blue", "Green", "Red"], correct: 0 },
    { prompt: "Grass?", options: ["Blue", "Green"], correct: 1 },
  ],
};
const outline = (locked: boolean) => ({ modules: [{ id: "m1", title: "M", unlockDay: 0, locked, lessons: [{ id: LESSON, title: "L", hasVideo: false, locked }] }], lessonIds: [LESSON] });
const withLesson = (quiz: LessonQuiz | null | undefined) => player.loadPlayerCourse.mockResolvedValue({ product: {}, modules: [], lessons: [{ _id: LESSON, quiz }], files: [] });

beforeEach(() => {
  vi.clearAllMocks();
  db.orders.findOne.mockResolvedValue({ _id: ORDER, productId: COURSE, storeId: "store-1", status: "paid", paidAt });
  db.products.findOne.mockResolvedValue({ _id: COURSE, type: "course", course: { accessDays: null } });
  db.lessonProgress.find.mockReturnValue({ toArray: async () => [] });
  db.lessonProgress.updateOne.mockResolvedValue({});
  db.quizAttempts.updateOne.mockResolvedValue({});
  db.quizAttempts.findOne.mockResolvedValue(null);
  mockSession({ id: userId, email: "student@example.com" });
  rateLimit.takeRateLimit.mockResolvedValue(true);
  withLesson(QUIZ);
  player.buildOutline.mockReturnValue(outline(false));
});

describe("quiz rules", () => {
  it("grade with a rounded-down percent against the pass mark", () => {
    expect(gradeQuiz(QUIZ, [1, 0, 1])).toEqual({ correctCount: 3, total: 3, percent: 100, passed: true, results: [true, true, true] });
    // 2 of 3 = 66%: below 70%.
    expect(gradeQuiz(QUIZ, [1, 0, 0])).toMatchObject({ correctCount: 2, percent: 66, passed: false, results: [true, true, false] });
    expect(gradeQuiz({ ...QUIZ, passPercent: 66 }, [1, 0, 0]).passed).toBe(true);
    expect(gradeQuiz(QUIZ, [1]).correctCount).toBe(1);
  });

  it("never give students the right answers", () => {
    const student = studentQuizOf(QUIZ);
    expect(student).toEqual({ passPercent: 70, questions: QUIZ.questions.map(({ prompt, options }) => ({ prompt, options })) });
    expect(JSON.stringify(student)).not.toContain("correct");
    expect(studentQuizOf(null)).toBeNull();
    expect(studentQuizOf({ passPercent: 70, questions: [] })).toBeNull();
  });

  it("clean the creator's text and check every limit", () => {
    const parsed = quizInput.parse({ passPercent: 80, questions: [{ prompt: " <b>Hi</b>  there ", options: ["<i>a</i>", "b"], correct: 1 }] });
    expect(parsed).toEqual({ passPercent: 80, questions: [{ prompt: "Hi there", options: ["a", "b"], correct: 1 }] });
    expect(quizInput.parse(null)).toBeNull();
    const fail = (input: unknown) => quizInput.safeParse(input).error?.issues[0]?.message;
    expect(fail({ passPercent: 40, questions: [{ prompt: "Q", options: ["a", "b"], correct: 0 }] })).toMatch(/Pass mark/);
    expect(fail({ passPercent: 70, questions: [] })).toMatch(/at least one question/);
    expect(fail({ passPercent: 70, questions: [{ prompt: "Q", options: ["a"], correct: 0 }] })).toMatch(/at least 2 options/);
    expect(fail({ passPercent: 70, questions: [{ prompt: "Q", options: ["a", "b"], correct: 2 }] })).toMatch(/right answer/);
    expect(fail({ passPercent: 70, questions: [{ prompt: "Q", options: ["Yes", "yes"], correct: 0 }] })).toMatch(/different/);
    expect(fail({ passPercent: 70, questions: [{ prompt: "<b></b>", options: ["a", "b"], correct: 0 }] })).toMatch(/Question 1: enter some text/);
    expect(fail({ passPercent: 70, questions: Array.from({ length: 11 }, () => ({ prompt: "Q", options: ["a", "b"], correct: 0 })) })).toMatch(/up to 10/);
  });
});

describe("submitting a quiz", () => {
  it("grades on the server, keeps the score and completes the lesson on a pass", async () => {
    db.quizAttempts.findOne.mockResolvedValue({ attempts: 1, lastPercent: 100, bestPercent: 100, passedAt: new Date() });
    const result = await submitLessonQuiz(ORDER, LESSON, [1, 0, 1]);
    expect(result).toEqual({ ok: true, data: { correctCount: 3, total: 3, percent: 100, passed: true, passPercent: 70, results: [true, true, true], bestPercent: 100, attempts: 1 } });
    const [filter, update] = db.quizAttempts.updateOne.mock.calls[0] ?? [];
    expect(filter).toEqual({ _id: `${ORDER}:${LESSON}`, orderId: ORDER });
    expect(update).toMatchObject({ $inc: { attempts: 1 }, $max: { bestPercent: 100 }, $set: { lastPercent: 100 } });
    // The first pass is set once, only where it is still empty.
    expect(db.quizAttempts.updateOne.mock.calls[1]?.[0]).toEqual({ _id: `${ORDER}:${LESSON}`, orderId: ORDER, passedAt: null });
    expect(db.lessonProgress.updateOne).toHaveBeenCalledWith({ _id: `${ORDER}:${LESSON}` }, expect.anything(), { upsert: true });
    // Only scores are stored, not the answers.
    expect(JSON.stringify(db.quizAttempts.updateOne.mock.calls)).not.toContain("answers");
  });

  it("keeps a failed try without completing the lesson", async () => {
    db.quizAttempts.findOne.mockResolvedValue({ attempts: 2, lastPercent: 33, bestPercent: 66, passedAt: null });
    expect(await submitLessonQuiz(ORDER, LESSON, [0, 0, 0])).toMatchObject({ ok: true, data: { percent: 33, passed: false, bestPercent: 66, attempts: 2 } });
    expect(db.quizAttempts.updateOne).toHaveBeenCalledTimes(1);
    expect(db.lessonProgress.updateOne).not.toHaveBeenCalled();
  });

  it("refuses bad answers, a changed quiz, a lesson without a quiz, a locked lesson and too many tries", async () => {
    expect(await submitLessonQuiz(ORDER, LESSON, ["1"])).toMatchObject({ ok: false });
    expect(await submitLessonQuiz(ORDER, LESSON, [9])).toMatchObject({ ok: false });
    expect(await submitLessonQuiz(ORDER, LESSON, [1, 0])).toMatchObject({ ok: false, error: expect.stringMatching(/changed/) });
    withLesson(undefined);
    expect(await submitLessonQuiz(ORDER, LESSON, [1, 0, 1])).toMatchObject({ ok: false, error: "This lesson has no quiz." });
    withLesson(QUIZ);
    player.buildOutline.mockReturnValue(outline(true));
    expect(await submitLessonQuiz(ORDER, LESSON, [1, 0, 1])).toMatchObject({ ok: false, error: "This lesson isn't open yet." });
    player.buildOutline.mockReturnValue(outline(false));
    rateLimit.takeRateLimit.mockResolvedValue(false);
    expect(await submitLessonQuiz(ORDER, LESSON, [1, 0, 1])).toMatchObject({ ok: false, error: expect.stringMatching(/Too many/) });
    expect(db.quizAttempts.updateOne).not.toHaveBeenCalled();
  });

  it("refuses another email's order and a refunded one", async () => {
    db.orders.findOne.mockResolvedValueOnce(null);
    expect(await submitLessonQuiz(ORDER, LESSON, [1, 0, 1])).toMatchObject({ ok: false });
    db.orders.findOne.mockResolvedValueOnce({ _id: ORDER, productId: COURSE, storeId: "store-1", status: "refunded", paidAt });
    expect(await submitLessonQuiz(ORDER, LESSON, [1, 0, 1])).toMatchObject({ ok: false, error: expect.stringMatching(/refunded/) });
    expect(db.orders.findOne.mock.calls[0]?.[0]).toEqual({ _id: ORDER, buyerEmail: "student@example.com" });
    expect(db.quizAttempts.updateOne).not.toHaveBeenCalled();
  });
});

describe("Mark as complete with a quiz", () => {
  it("is refused until the quiz is passed, and allowed after", async () => {
    expect(await markLessonComplete(ORDER, LESSON, true)).toEqual({ ok: false, error: "Pass the quiz to complete this lesson." });
    expect(db.lessonProgress.updateOne).not.toHaveBeenCalled();
    db.quizAttempts.findOne.mockResolvedValue({ attempts: 1, lastPercent: 100, bestPercent: 100, passedAt: new Date() });
    expect(await markLessonComplete(ORDER, LESSON, true)).toMatchObject({ ok: true });
  });

  it("works as before for a lesson without a quiz, and unmarking is always allowed", async () => {
    db.lessonProgress.deleteOne.mockResolvedValue({});
    expect(await markLessonComplete(ORDER, LESSON, false)).toMatchObject({ ok: true });
    withLesson(null);
    expect(await markLessonComplete(ORDER, LESSON, true)).toMatchObject({ ok: true });
  });
});
