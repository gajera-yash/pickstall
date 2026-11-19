import { type NextRequest } from "next/server";

import { failJson, startUploadResponse } from "@/lib/files/upload-routes";
import { isUuid } from "@/lib/media/media";

// Step 1 of a lesson attachment upload (D-055, D-093): `{ name, size }` in, a pending upload and
// where the browser sends the bytes out. The store comes from the session; the course and lesson
// must belong to it. Removal is a server action.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  if (!isUuid(id) || !isUuid(lessonId)) return failJson("We couldn't find that lesson.", 404);
  return startUploadResponse(request, { kind: "lesson", courseId: id, lessonId });
}
