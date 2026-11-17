import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { FILE_UPLOADS_OFF_MESSAGE, fileStorageAvailable } from "@/lib/files/storage";
import { PRODUCT_FILE_MAX_BYTES, PRODUCT_FILE_UPLOAD_RATE_LIMIT } from "@/lib/config";
import { saveLessonAttachment } from "@/lib/courses/attachments";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { findStoreByOwner } from "@/lib/stores/queries";

const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });

// Lesson attachment upload (D-055), like the product file upload (D-050): the raw file is the body,
// its name is in `X-File-Name`. The store comes from the session; the course and lesson must belong
// to it. The body is streamed to private storage, never held in memory. Removal is a server action.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  if (!isUuid(id) || !isUuid(lessonId)) return fail("We couldn't find that lesson.", 404);
  if (!fileStorageAvailable()) return fail(FILE_UPLOADS_OFF_MESSAGE, 503);

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > PRODUCT_FILE_MAX_BYTES) return fail(`Use a file under ${PRODUCT_FILE_MAX_BYTES / 1024 / 1024} MB.`, 413);

  const rawName = decodeURIComponent(request.headers.get("x-file-name") ?? "").slice(0, 300);
  if (!rawName || !request.body) return fail("Choose a file to upload.", 400);

  try {
    const user = await getCurrentUser();
    if (!user) return fail("Sign in to upload.", 401);
    const store = await findStoreByOwner(user.id);
    if (!store) return fail("Create your store first.", 403);
    const { max, windowMinutes } = PRODUCT_FILE_UPLOAD_RATE_LIMIT;
    if (!(await takeRateLimit(rateLimitKey("product-file:owner", user.id), max, windowMinutes))) return fail("Slow down a little, then try again.", 429);

    const result = await saveLessonAttachment(store.id, id, lessonId, rawName, request.body);
    if (!result.ok) return fail(result.error, result.status);
    return NextResponse.json({ file: result.data }, { status: 201, headers: NO_STORE });
  } catch (error) {
    logger.error("courses.attachment_upload_failed", { name: error instanceof Error ? error.name : undefined });
    return fail("Couldn't upload that file. Check your connection and try again.", 500);
  }
}
