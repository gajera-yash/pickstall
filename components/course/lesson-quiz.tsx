"use client";

import { CheckCircle2, ListChecks, RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { StudentQuiz } from "@/lib/courses/quiz";
import { submitLessonQuiz, type QuizResult } from "@/lib/courses/student-actions";
import type { QuizStatus } from "@/lib/courses/student";
import { cn } from "@/lib/utils";

/**
 * The student's lesson quiz (D-110). Answers are graded on the server; the result says which
 * questions were right (not which option was), so a retry still needs thinking.
 */
export function LessonQuiz({ orderId, lessonId, quiz, status }: { orderId: string; lessonId: string; quiz: StudentQuiz; status: QuizStatus | null }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const allAnswered = answers.every((answer) => answer !== null);

  const submit = () => {
    if (!allAnswered) {
      setProblem("Answer every question, then submit.");
      return;
    }
    setProblem(null);
    start(async () => {
      const outcome = await submitLessonQuiz(orderId, lessonId, answers);
      if (!outcome.ok) {
        setProblem(outcome.error);
        return;
      }
      setResult(outcome.data);
      // Progress and the lesson list are drawn on the server.
      if (outcome.data.passed) router.refresh();
    });
  };

  const retry = () => {
    setResult(null);
    setAnswers(quiz.questions.map(() => null));
  };

  return (
    <Card className="gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 font-display text-h4">
          <ListChecks aria-hidden="true" className="size-5 text-blue" />
          Quiz
        </h2>
        <p className="text-sm text-mute">
          {quiz.questions.length} {quiz.questions.length === 1 ? "question" : "questions"}. Score {quiz.passPercent}% or more to pass and complete this lesson.
          {status && ` Best so far: ${status.bestPercent}%${status.passed ? " (passed)" : ""}.`}
        </p>
      </div>

      {result && (
        <Alert variant={result.passed ? "success" : "warning"} role="status">
          <AlertDescription>
            {result.passed
              ? `You passed with ${result.percent}% (${result.correctCount} of ${result.total}). This lesson is complete.`
              : `You scored ${result.percent}% (${result.correctCount} of ${result.total}). You need ${result.passPercent}% to pass. Review the lesson and try again.`}
          </AlertDescription>
        </Alert>
      )}

      <ol className="flex flex-col gap-4">
        {quiz.questions.map((question, index) => {
          const right = result?.results[index];
          return (
            <li key={index}>
              <fieldset className={cn("flex flex-col gap-2 rounded-md border p-3", right === undefined ? "border-line" : right ? "border-mint" : "border-danger")}>
                <legend className="flex items-start gap-2 px-1 text-sm font-semibold">
                  <span className="break-words">
                    {index + 1}. {question.prompt}
                  </span>
                  {right !== undefined &&
                    (right ? (
                      <CheckCircle2 aria-label="Right" className="size-4 shrink-0 text-mint" />
                    ) : (
                      <XCircle aria-label="Wrong" className="size-4 shrink-0 text-danger" />
                    ))}
                </legend>
                <RadioGroup
                  value={answers[index] === null ? "" : String(answers[index])}
                  onValueChange={(value) => setAnswers((current) => current.map((answer, i) => (i === index ? Number(value) : answer)))}
                  disabled={result !== null || pending}
                  className="gap-2"
                >
                  {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex min-h-10 items-center gap-3">
                      <RadioGroupItem id={`q-${index}-${optionIndex}`} value={String(optionIndex)} />
                      <Label htmlFor={`q-${index}-${optionIndex}`} className="font-normal break-words">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col items-start gap-2">
        {result ? (
          !result.passed && (
            <Button type="button" variant="secondary" onClick={retry}>
              <RotateCcw aria-hidden="true" className="size-4" />
              Try again
            </Button>
          )
        ) : (
          <Button type="button" onClick={submit} loading={pending}>
            Submit answers
          </Button>
        )}
        {problem && <FieldError>{problem}</FieldError>}
      </div>
    </Card>
  );
}

/** The creator's preview of a quiz: the questions only, no answering (D-110). */
export function QuizPreview({ quiz }: { quiz: StudentQuiz }) {
  return (
    <Card className="gap-3">
      <h2 className="flex items-center gap-2 font-display text-h4">
        <ListChecks aria-hidden="true" className="size-5 text-blue" />
        Quiz
      </h2>
      <p className="text-sm text-mute">
        Students answer {quiz.questions.length} {quiz.questions.length === 1 ? "question" : "questions"} here and need {quiz.passPercent}% to pass.
      </p>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        {quiz.questions.map((question, index) => (
          <li key={index} className="break-words">
            {question.prompt}
          </li>
        ))}
      </ol>
    </Card>
  );
}
