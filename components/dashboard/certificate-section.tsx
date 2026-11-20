"use client";

import { Award } from "lucide-react";
import { useState } from "react";

import { FieldError } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { saveCourseCertificate } from "@/lib/courses/actions";

/** Course certificates on or off (D-111). Saves as soon as it is switched. */
export function CertificateSection({ courseId, initial }: { courseId: string; initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const change = async (next: boolean) => {
    setEnabled(next);
    setSaving(true);
    setProblem(null);
    const result = await saveCourseCertificate(courseId, next);
    setSaving(false);
    if (!result.ok) {
      setEnabled(!next);
      setProblem(result.error);
    }
  };

  return (
    <section aria-labelledby="certificate-title" className="flex flex-col gap-2 rounded-md border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="certificate-title" className="flex items-center gap-2 font-display text-h4">
          <Award aria-hidden="true" className="size-5 text-blue" />
          Certificate
        </h3>
        <Switch checked={enabled} onCheckedChange={change} disabled={saving} aria-label="Give a certificate when a student finishes the course" />
      </div>
      <p className="text-sm text-mute">
        {enabled
          ? "Students who finish every lesson (and pass every quiz) can get a certificate with their name, the course and your store name. They can print it or save it as a PDF."
          : "Turn on to give students a certificate when they finish every lesson."}
      </p>
      {problem && <FieldError>{problem}</FieldError>}
    </section>
  );
}
