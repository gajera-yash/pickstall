import { z } from "zod";

import { cleanText } from "@/lib/products/text";

// Lesson quizzes (D-110). Client-safe: the creator's editor, the server checks and the grading all
// use these rules. A quiz is a list of single-choice questions with one right option each. Students
// only ever receive `StudentQuiz` (no right answers); grading happens on the server.

export const QUIZ_LIMITS = {
  questionsMax: 10,
  optionsMin: 2,
  optionsMax: 5,
  question: 300,
  option: 150,
  passMin: 50,
  passMax: 100,
  passDefault: 70,
} as const;

export type QuizQuestion = { prompt: string; options: string[]; correct: number };
export type LessonQuiz = { passPercent: number; questions: QuizQuestion[] };

/** What a student sees: the questions and options, never which one is right. */
export type StudentQuiz = { passPercent: number; questions: { prompt: string; options: string[] }[] };

export type QuizGrade = { correctCount: number; total: number; percent: number; passed: boolean; results: boolean[] };

/** A new, empty question for the editor. */
export const blankQuestion = (): QuizQuestion => ({ prompt: "", options: ["", ""], correct: 0 });

export function studentQuizOf(quiz: LessonQuiz | null | undefined): StudentQuiz | null {
  if (!quiz || quiz.questions.length === 0) return null;
  return { passPercent: quiz.passPercent, questions: quiz.questions.map((question) => ({ prompt: question.prompt, options: [...question.options] })) };
}

/**
 * Grades a student's answers (one option index per question). A missing or out-of-range answer is
 * wrong. The percent is rounded down, so 69.9% does not pass a 70% mark.
 */
export function gradeQuiz(quiz: LessonQuiz, answers: readonly number[]): QuizGrade {
  const results = quiz.questions.map((question, index) => answers[index] === question.correct);
  const correctCount = results.filter(Boolean).length;
  const total = quiz.questions.length;
  const percent = total === 0 ? 0 : Math.floor((correctCount * 100) / total);
  return { correctCount, total, percent, passed: total > 0 && percent >= quiz.passPercent, results };
}

const line = (max: number, label: string) =>
  z
    .string({ error: `${label}: enter some text.` })
    .max(max * 4)
    .transform((value) => cleanText(value).replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, { error: `${label}: enter some text.` }).max(max, { error: `${label}: ${max} characters or fewer.` }));

const questionInput = (index: number) =>
  z
    .object({
      prompt: line(QUIZ_LIMITS.question, `Question ${index + 1}`),
      options: z
        .array(line(QUIZ_LIMITS.option, `Question ${index + 1}, an option`))
        .min(QUIZ_LIMITS.optionsMin, { error: `Question ${index + 1}: add at least ${QUIZ_LIMITS.optionsMin} options.` })
        .max(QUIZ_LIMITS.optionsMax, { error: `Question ${index + 1}: up to ${QUIZ_LIMITS.optionsMax} options.` }),
      correct: z.number().int().min(0),
    })
    .refine((question) => question.correct < question.options.length, { error: `Question ${index + 1}: pick the right answer.` })
    .refine((question) => new Set(question.options.map((option) => option.toLowerCase())).size === question.options.length, { error: `Question ${index + 1}: each option must be different.` });

/** The quiz as the editor sends it: null removes it. Every text is cleaned of tags here. */
export const quizInput = z
  .object({
    passPercent: z.number({ error: "Pass mark: enter a number." }).int({ error: "Pass mark: a whole number." }).min(QUIZ_LIMITS.passMin, { error: `Pass mark: ${QUIZ_LIMITS.passMin}% to ${QUIZ_LIMITS.passMax}%.` }).max(QUIZ_LIMITS.passMax, { error: `Pass mark: ${QUIZ_LIMITS.passMin}% to ${QUIZ_LIMITS.passMax}%.` }),
    questions: z
      .array(z.unknown())
      .min(1, { error: "Add at least one question, or remove the quiz." })
      .max(QUIZ_LIMITS.questionsMax, { error: `A quiz can have up to ${QUIZ_LIMITS.questionsMax} questions.` }),
  })
  .transform((input, ctx): LessonQuiz => {
    const questions: QuizQuestion[] = [];
    for (const [index, raw] of input.questions.entries()) {
      const parsed = questionInput(index).safeParse(raw);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? `Check question ${index + 1}.` });
        return z.NEVER;
      }
      questions.push(parsed.data);
    }
    return { passPercent: input.passPercent, questions };
  })
  .nullable();

/** The student's answers: one option index per question, nothing else. */
export const quizAnswersInput = z.array(z.number().int().min(0).max(QUIZ_LIMITS.optionsMax - 1)).min(1).max(QUIZ_LIMITS.questionsMax);
