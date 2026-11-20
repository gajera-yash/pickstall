import { z } from "zod";

import { cleanText } from "@/lib/products/text";

// Course certificate rules (D-111). Client-safe.

export const CERTIFICATE_NAME_MAX = 80;

/** The name printed on the certificate: cleaned of tags and extra spaces, 2-80 characters. */
export const certificateNameInput = z
  .string()
  .max(CERTIFICATE_NAME_MAX * 4)
  .transform((value) => cleanText(value).replace(/\s+/g, " ").trim())
  .pipe(z.string().min(2, { error: "Enter the name for your certificate." }).max(CERTIFICATE_NAME_MAX, { error: `Use ${CERTIFICATE_NAME_MAX} characters or fewer.` }));

/** A course is finished when it has lessons and every one of them is complete. */
export function courseFinished(lessonIds: readonly string[], completed: readonly string[]): boolean {
  if (lessonIds.length === 0) return false;
  const done = new Set(completed);
  return lessonIds.every((id) => done.has(id));
}
