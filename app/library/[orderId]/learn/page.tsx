import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CoursePlayer } from "@/components/course/course-player";
import { MarkComplete } from "@/components/course/mark-complete";
import { formatDay } from "@/components/dashboard/orders-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/guards";
import { buildOutline, loadPlayerCourse, playerLessonOf } from "@/lib/courses/player";
import { completedLessons, courseAccess } from "@/lib/courses/student";
import { isUuid } from "@/lib/media/media";

const BLOCKED: Record<string, string> = {
  refunded: "This purchase was refunded, so access to the course has been removed.",
  expired: "Your access to this course has ended. Contact the creator if you need more time.",
};

// The student's course (PRD F13, D-057): the course player for a course this signed-in email
// bought. Access (paid, not refunded, within the access period) is checked on every load, and a
// lesson in a module that drip has not opened yet cannot be shown, whatever the URL says.
export default function LearnPage({ params, searchParams }: PageProps<"/library/[orderId]/learn">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-lg" />}>
      <Learn params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Learn({ params, searchParams }: PageProps<"/library/[orderId]/learn">) {
  const [{ orderId }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/library/${orderId}/learn`);
  if (!isUuid(orderId) || !user.email) notFound();

  const now = new Date();
  const access = await courseAccess(user.email, orderId, now);
  if (!access.ok) {
    if (access.reason === "not_found" || access.reason === "not_course") notFound();
    return (
      <>
        <BackLink orderId={orderId} />
        <Alert variant="warning">
          <AlertDescription>{BLOCKED[access.reason]}</AlertDescription>
        </Alert>
      </>
    );
  }

  const course = await loadPlayerCourse(access.storeId, access.courseId);
  if (!course) notFound();
  const outline = buildOutline(course, access.enrolledAt, now);
  const completed = await completedLessons(orderId);
  const open = outline.modules.flatMap((item) => item.lessons).filter((lesson) => !lesson.locked);
  const wanted = typeof query.lesson === "string" ? open.find((lesson) => lesson.id === query.lesson) : undefined;
  // Without a choice: the first open lesson not done yet, else the first open one.
  const current = wanted ?? open.find((lesson) => !completed.includes(lesson.id)) ?? open[0];
  const lesson = current ? playerLessonOf(course, current.id, now) : null;
  const base = `/library/${orderId}`;

  return (
    <CoursePlayer
      title={course.product.title}
      outline={outline}
      lesson={lesson}
      lessonHref={(id) => `${base}/learn?lesson=${id}`}
      fileHref={(fileId) => `${base}/files/${fileId}`}
      completed={completed}
      completeAction={lesson ? <MarkComplete key={lesson.id} orderId={orderId} lessonId={lesson.id} done={completed.includes(lesson.id)} /> : null}
      banner={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BackLink orderId={orderId} />
          {access.expiresAt && (
            <p className="inline-flex items-center gap-1 text-sm text-mute">
              <Clock aria-hidden="true" className="size-4" />
              Access until {formatDay(access.expiresAt)}
            </p>
          )}
        </div>
      }
    />
  );
}

function BackLink({ orderId }: { orderId: string }) {
  return (
    <Link href={`/library/${orderId}`} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
      <ArrowLeft aria-hidden="true" className="size-4" />
      Your purchase
    </Link>
  );
}
