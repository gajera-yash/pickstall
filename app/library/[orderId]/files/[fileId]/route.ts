import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/guards";
import { buildOutline, loadPlayerCourse } from "@/lib/courses/player";
import { courseAccess } from "@/lib/courses/student";
import { openFileForDownload } from "@/lib/files/product-files";
import { attachmentHeader } from "@/lib/files/types";
import { logger } from "@/lib/logger";
import { isUuid } from "@/lib/media/media";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";

const NO_STORE = { "Cache-Control": "private, no-store" };

// A lesson file for a student (D-057). Checked on every download: the signed-in email bought the
// course, access has not ended or been refunded, the file belongs to a lesson of that course, and
// the lesson's module is open (drip). The file streams from private storage as an attachment.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ orderId: string; fileId: string }> }) {
  const { orderId, fileId } = await params;
  if (!isUuid(orderId) || !isUuid(fileId)) return new NextResponse("Not found.", { status: 404, headers: NO_STORE });

  const user = await getCurrentUser();
  if (!user?.email) return new NextResponse("Sign in to download.", { status: 401, headers: NO_STORE });

  try {
    if (!(await takeRateLimit(rateLimitKey("lesson-file:user", user.id), 60, 10))) return new NextResponse("Slow down a little, then try again.", { status: 429, headers: NO_STORE });
    const now = new Date();
    const access = await courseAccess(user.email, orderId, now);
    if (!access.ok) return new NextResponse(access.reason === "not_found" || access.reason === "not_course" ? "Not found." : "Your access to this course has ended.", { status: access.reason === "not_found" || access.reason === "not_course" ? 404 : 403, headers: NO_STORE });

    const course = await loadPlayerCourse(access.storeId, access.courseId);
    const file = course?.files.find((item) => item._id === fileId);
    if (!course || !file?.lessonId) return new NextResponse("Not found.", { status: 404, headers: NO_STORE });
    const lesson = buildOutline(course, access.enrolledAt, now).modules.flatMap((item) => item.lessons).find((entry) => entry.id === file.lessonId);
    if (!lesson || lesson.locked) return new NextResponse("This lesson isn't open yet.", { status: 403, headers: NO_STORE });

    const download = await openFileForDownload(access.storeId, fileId);
    if (!download) return new NextResponse("Not found.", { status: 404, headers: NO_STORE });
    return new Response(download.stream, {
      headers: {
        ...NO_STORE,
        "Content-Type": download.mime,
        "Content-Length": String(download.size),
        "Content-Disposition": attachmentHeader(download.name),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    logger.error("courses.file_download_failed", { name: error instanceof Error ? error.name : undefined });
    return new NextResponse("Couldn't download that file. Try again.", { status: 500, headers: NO_STORE });
  }
}
