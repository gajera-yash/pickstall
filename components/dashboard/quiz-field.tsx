"use client";

import { ListChecks, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { QUIZ_LIMITS, blankQuestion, type LessonQuiz, type QuizQuestion } from "@/lib/courses/quiz";

/**
 * The lesson quiz editor (D-110): single-choice questions, each with 2-5 options and one right
 * answer picked with a radio button, plus the pass mark. Saved with the lesson.
 */
export function QuizField({ quiz, onChange, error }: { quiz: LessonQuiz | null; onChange: (quiz: LessonQuiz | null) => void; error: string | null }) {
  const on = quiz !== null;
  const setQuestion = (index: number, next: QuizQuestion) => quiz && onChange({ ...quiz, questions: quiz.questions.map((question, i) => (i === index ? next : question)) });

  return (
    <section aria-labelledby="quiz-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="quiz-title" className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks aria-hidden="true" className="size-4 text-mute" />
          Quiz (optional)
        </h3>
        <Switch checked={on} onCheckedChange={(checked) => onChange(checked ? { passPercent: QUIZ_LIMITS.passDefault, questions: [blankQuestion()] } : null)} aria-label="Add a quiz to this lesson" />
      </div>

      {quiz && (
        <>
          <div className="flex items-center gap-2">
            <Label htmlFor="quizPass" className="shrink-0">
              Pass mark
            </Label>
            <Input
              id="quizPass"
              type="number"
              inputMode="numeric"
              min={QUIZ_LIMITS.passMin}
              max={QUIZ_LIMITS.passMax}
              value={Number.isNaN(quiz.passPercent) ? "" : quiz.passPercent}
              onChange={(event) => onChange({ ...quiz, passPercent: event.target.valueAsNumber })}
              className="w-24"
            />
            <span className="text-sm text-mute">%</span>
          </div>

          <ol className="flex flex-col gap-3">
            {quiz.questions.map((question, index) => (
              <li key={index} className="flex flex-col gap-3 rounded-md border border-line p-3">
                <div className="flex items-start gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Label htmlFor={`quiz-q-${index}`}>Question {index + 1}</Label>
                    <Input id={`quiz-q-${index}`} value={question.prompt} maxLength={QUIZ_LIMITS.question} onChange={(event) => setQuestion(index, { ...question, prompt: event.target.value })} placeholder="What does a primary button do?" />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove question ${index + 1}`}
                    onClick={() => onChange(quiz.questions.length === 1 ? null : { ...quiz, questions: quiz.questions.filter((_, i) => i !== index) })}
                    className="mt-7 shrink-0 text-danger"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </div>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-xs text-mute">Options: pick the right answer</legend>
                  <RadioGroup value={String(question.correct)} onValueChange={(value) => setQuestion(index, { ...question, correct: Number(value) })} aria-label={`Right answer for question ${index + 1}`} className="gap-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <RadioGroupItem value={String(optionIndex)} aria-label={`Option ${optionIndex + 1} is the right answer`} />
                        <Input
                          aria-label={`Question ${index + 1}, option ${optionIndex + 1}`}
                          value={option}
                          maxLength={QUIZ_LIMITS.option}
                          onChange={(event) => setQuestion(index, { ...question, options: question.options.map((item, i) => (i === optionIndex ? event.target.value : item)) })}
                          placeholder={`Option ${optionIndex + 1}`}
                        />
                        {question.options.length > QUIZ_LIMITS.optionsMin && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove option ${optionIndex + 1}`}
                            onClick={() => {
                              const options = question.options.filter((_, i) => i !== optionIndex);
                              // Keep the same right option selected when an earlier one is removed.
                              const correct = question.correct === optionIndex ? 0 : question.correct > optionIndex ? question.correct - 1 : question.correct;
                              setQuestion(index, { ...question, options, correct });
                            }}
                            className="shrink-0 text-danger"
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </RadioGroup>
                  {question.options.length < QUIZ_LIMITS.optionsMax && (
                    <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setQuestion(index, { ...question, options: [...question.options, ""] })}>
                      <Plus aria-hidden="true" className="size-4" />
                      Add an option
                    </Button>
                  )}
                </fieldset>
              </li>
            ))}
          </ol>

          {quiz.questions.length < QUIZ_LIMITS.questionsMax && (
            <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => onChange({ ...quiz, questions: [...quiz.questions, blankQuestion()] })}>
              <Plus aria-hidden="true" className="size-4" />
              Add a question
            </Button>
          )}
        </>
      )}

      {error ? (
        <FieldError>{error}</FieldError>
      ) : (
        <FieldHint>{on ? `Students need ${Number.isNaN(quiz?.passPercent) ? "the pass mark" : `${quiz?.passPercent}%`} to pass. Passing completes the lesson; they can try again as often as they like.` : "Check what students learned. Up to 10 questions."}</FieldHint>
      )}
    </section>
  );
}
