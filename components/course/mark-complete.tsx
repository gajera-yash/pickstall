"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { markLessonComplete } from "@/lib/courses/student-actions";

/** The student's "Mark as complete" toggle for the lesson they are on (D-057). */
export function MarkComplete({ orderId, lessonId, done: initialDone }: { orderId: string; lessonId: string; done: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !done;
    setProblem(null);
    setDone(next);
    start(async () => {
      const result = await markLessonComplete(orderId, lessonId, next);
      if (!result.ok) {
        setDone(!next);
        setProblem(result.error);
        return;
      }
      // The progress bar and the lesson list are drawn on the server.
      router.refresh();
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
      <Button type="button" variant={done ? "secondary" : "default"} onClick={toggle} loading={pending} aria-pressed={done}>
        {!pending && (done ? <CheckCircle2 aria-hidden="true" className="size-5 text-mint" /> : <Circle aria-hidden="true" className="size-5" />)}
        {done ? "Completed" : "Mark as complete"}
      </Button>
      {problem && <FieldError>{problem}</FieldError>}
    </div>
  );
}
