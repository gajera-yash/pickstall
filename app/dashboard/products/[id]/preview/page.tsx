import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CoursePlayer } from "@/components/course/course-player";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { buildOutline, loadPlayerCourse, playerLessonOf } from "@/lib/courses/player";
import { productIdInput } from "@/lib/products/schemas";

// The creator's student preview of a course (D-056): the real player with every module open, so
// the creator can watch each lesson. Drip days show as labels. Found with the session owner's
// store id, so another creator's course is a 404.
export default function CoursePreviewPage({ params, searchParams }: PageProps<"/dashboard/products/[id]/preview">) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-lg" />}>
      <Preview params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ params, searchParams }: PageProps<"/dashboard/products/[id]/preview">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { store } = await requireCreator(`/dashboard/products/${id}/preview`);
  if (!productIdInput.safeParse(id).success) notFound();
  const course = await loadPlayerCourse(store.id, id);
  if (!course) notFound();

  const now = new Date();
  const outline = buildOutline(course, null, now);
  const wanted = typeof query.lesson === "string" ? query.lesson : undefined;
  const lessonId = wanted && outline.lessonIds.includes(wanted) ? wanted : outline.lessonIds[0];
  const lesson = lessonId ? playerLessonOf(course, lessonId, now) : null;
  const base = `/dashboard/products/${id}/preview`;

  return (
    <CoursePlayer
      title={course.product.title}
      outline={outline}
      lesson={lesson}
      lessonHref={(lesson) => `${base}?lesson=${lesson}`}
      banner={
        <div className="flex flex-col gap-3">
          <Link href={`/dashboard/products/${id}`} className="inline-flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to the course editor
          </Link>
          <Alert variant="info">
            <AlertTitle>Student preview</AlertTitle>
            <AlertDescription>This is how students see your course. Every module is open here; with drip on, students get each one on its day. Progress and &ldquo;Mark as complete&rdquo; work for students only.</AlertDescription>
          </Alert>
        </div>
      }
    />
  );
}
