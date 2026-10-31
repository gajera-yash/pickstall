import { ANSWER_MAX_CHARS } from "@/lib/config";
import type { CheckoutQuestionDoc, OrderAnswerDoc } from "@/lib/db/collections";
import { cleanText } from "@/lib/products/text";

export type AnswersResult = { ok: true; answers: OrderAnswerDoc[] } | { ok: false; error: string; questionId: string };

/**
 * Checks a buyer's answers against the product's own question definitions (never against anything
 * the client says about them): required answers present, dropdown values one of the choices,
 * checkbox yes/no, text cleaned of tags and length-limited. Unknown ids are ignored. The label is
 * copied into the answer, so later edits to the question do not change old orders.
 */
export function validateAnswers(questions: CheckoutQuestionDoc[], raw: Record<string, unknown>): AnswersResult {
  const answers: OrderAnswerDoc[] = [];

  for (const question of questions) {
    const given = raw[question.id];
    const text = typeof given === "string" ? given : "";

    if (question.kind === "checkbox") {
      const checked = given === "true" || given === "on" || given === true;
      if (question.required && !checked) return { ok: false, error: "Tick this box to continue.", questionId: question.id };
      answers.push({ questionId: question.id, label: question.label, value: checked ? "Yes" : "No" });
      continue;
    }

    const multiline = question.kind === "long_text";
    const value = cleanText(text, { multiline });
    if (value === "") {
      if (question.required) return { ok: false, error: "This answer is required.", questionId: question.id };
      continue;
    }

    if (question.kind === "dropdown") {
      if (!question.options.includes(value)) return { ok: false, error: "Pick one of the choices.", questionId: question.id };
    } else {
      const max = ANSWER_MAX_CHARS[question.kind];
      if (value.length > max) return { ok: false, error: `Use ${max} characters or fewer.`, questionId: question.id };
    }
    answers.push({ questionId: question.id, label: question.label, value });
  }

  return { ok: true, answers };
}
