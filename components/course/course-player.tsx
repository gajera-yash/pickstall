import { ArrowLeft, ArrowRight, CheckCircle2, Download, ExternalLink, FileText, Loader2, Lock, Paperclip, PlayCircle, VideoOff } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { RichTextView } from "@/components/store/rich-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { unlockLabel } from "@/lib/courses/drip";
import { formatBytes } from "@/lib/files/types";
import type { PlayerLesson, PlayerOutline } from "@/lib/courses/player";
import { cn } from "@/lib/utils";

/**
 * The course player (D-056): the lesson list on the left (below the lesson on phones), the lesson
 * on the right: video, notes, files and links, with previous / next. Used for the creator's
 * preview and, in G4, for students (who also get progress and "Mark as complete").
 */
export function CoursePlayer({
  title,
  outline,
  lesson,
  lessonHref,
  fileHref,
  completed = [],
  completeAction,
  quiz,
  aside,
  banner,
}: {
  title: string;
  outline: PlayerOutline;
  lesson: PlayerLesson | null;
  lessonHref: (lessonId: string) => string;
  /** Where a student downloads a lesson file; without it (the preview) files are listed only. */
  fileHref?: (fileId: string) => string;
  completed?: string[];
  /** The "Mark as complete" control for the current lesson (students only). */
  completeAction?: ReactNode;
  /** The lesson's quiz: answerable for students, a summary in the creator's preview (D-110). */
  quiz?: ReactNode;
  /** Shown under the lesson list, for example the student's certificate (D-111). */
  aside?: ReactNode;
  banner?: ReactNode;
}) {
  const total = outline.lessonIds.length;
  const done = completed.filter((id) => outline.lessonIds.includes(id)).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const index = lesson ? outline.lessonIds.indexOf(lesson.id) : -1;
  const lockedIds = new Set(outline.modules.flatMap((item) => (item.locked ? item.lessons.map((entry) => entry.id) : [])));
  const previous = index > 0 ? outline.lessonIds[index - 1] : undefined;
  const nextId = index >= 0 ? outline.lessonIds[index + 1] : undefined;
  const next = nextId && !lockedIds.has(nextId) ? nextId : undefined;

  return (
    <div data-layout="wide" className="flex flex-col gap-4">
      {banner}
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside aria-label="Course content" className="order-2 flex flex-col gap-4 lg:order-1 lg:sticky lg:top-22 lg:self-start">
          <Card className="gap-4 p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 rounded-md bg-blue-soft p-4">
              <p className="font-display text-h4 break-words">{title}</p>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-mute">
                  {done} of {total} {total === 1 ? "lesson" : "lessons"} complete
                </span>
                <span className="font-semibold text-ink tabular-nums">{percent}%</span>
              </div>
              <Progress value={percent} max={100} aria-label="Course progress" aria-valuetext={`${percent}% complete`} />
            </div>
            <nav aria-label="Lessons" className="flex flex-col gap-4">
              {outline.modules.map((item) => (
                <section key={item.id} aria-labelledby={`module-${item.id}`} className="flex flex-col gap-1">
                  <h2 id={`module-${item.id}`} className="flex items-center justify-between gap-2 text-xs font-semibold tracking-wide text-mute uppercase">
                    <span className="truncate">{item.title}</span>
                    {item.locked ? (
                      <Badge variant="draft">
                        <Lock aria-hidden="true" className="size-3" />
                        Day {item.unlockDay}
                      </Badge>
                    ) : item.unlockDay > 0 ? (
                      <Badge variant="draft">Day {item.unlockDay}</Badge>
                    ) : null}
                  </h2>
                  {item.locked && <p className="text-xs text-mute">{unlockLabel(true, item.unlockDay)}</p>}
                  <ol className="flex flex-col">
                    {item.lessons.map((entry) => {
                      const current = entry.id === lesson?.id;
                      const isDone = completed.includes(entry.id);
                      const Icon = entry.locked ? Lock : isDone ? CheckCircle2 : entry.hasVideo ? PlayCircle : FileText;
                      const number = outline.lessonIds.indexOf(entry.id) + 1;
                      const row = (
                        <>
                          <Icon aria-hidden="true" className={cn("size-4 shrink-0", isDone ? "text-mint" : current ? "text-blue" : "text-mute")} />
                          <span className="min-w-0 flex-1 truncate">
                            <span className="mr-1.5 text-xs text-mute tabular-nums">{number}.</span>
                            {entry.title}
                          </span>
                          {isDone && <span className="sr-only">(complete)</span>}
                        </>
                      );
                      return (
                        <li key={entry.id}>
                          {entry.locked ? (
                            <span className="flex min-h-10 items-center gap-2 rounded-sm px-2 text-sm text-mute" aria-disabled="true">
                              {row}
                              <span className="sr-only">(locked)</span>
                            </span>
                          ) : (
                            <Link
                              href={lessonHref(entry.id)}
                              aria-current={current ? "page" : undefined}
                              className={cn(
                                "flex min-h-11 items-center gap-2 rounded-sm border-l-2 px-2 text-sm transition-colors duration-(--dur-fast) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-glow",
                                current ? "border-blue bg-blue-soft font-semibold text-ink" : "border-transparent hover:bg-bg-subtle",
                              )}
                            >
                              {row}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </nav>
          </Card>
          {aside}
        </aside>

        <div className="order-1 flex min-w-0 flex-col gap-5 lg:order-2">
          {!lesson ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PlayCircle aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No lessons yet</EmptyTitle>
                <EmptyDescription>Lessons appear here once they are added to the course.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <LessonVideo video={lesson.video} title={lesson.title} />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  {index >= 0 && (
                    <p className="text-sm font-semibold text-blue">
                      Lesson {index + 1} of {total}
                    </p>
                  )}
                  <h1 className="font-display text-h2 break-words">{lesson.title}</h1>
                </div>
                {completeAction}
              </div>
              {lesson.bodyDoc && lesson.bodyDoc.content.length > 0 && (
                <Card>
                  <RichTextView doc={lesson.bodyDoc} />
                </Card>
              )}
              {(lesson.files.length > 0 || lesson.links.length > 0) && (
                <Card className="gap-3">
                  <h2 className="font-display text-h4">Resources</h2>
                  <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
                    {lesson.files.map((file) => (
                      <li key={file.id} className="flex items-center gap-3 px-3 py-2">
                        <Paperclip aria-hidden="true" className="size-4 shrink-0 text-blue" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-semibold">{file.name}</span>
                          <span className="text-xs text-mute">
                            {file.label}, {formatBytes(file.size)}
                          </span>
                        </span>
                        {fileHref ? (
                          <Button asChild variant="secondary" size="sm">
                            <a href={fileHref(file.id)} download>
                              <Download aria-hidden="true" className="size-4" />
                              Download
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-mute">Students download here</span>
                        )}
                      </li>
                    ))}
                    {lesson.links.map((link) => (
                      <li key={link.url} className="flex items-center gap-3 px-3 py-2">
                        <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-blue" />
                        <a href={link.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="min-w-0 flex-1 truncate text-sm font-semibold text-blue hover:underline">
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {quiz}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                {previous ? (
                  <Button asChild variant="ghost">
                    <Link href={lessonHref(previous)}>
                      <ArrowLeft aria-hidden="true" className="size-4" />
                      Previous
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
                {next && (
                  <Button asChild variant="secondary">
                    <Link href={lessonHref(next)}>
                      Next lesson
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LessonVideo({ video, title }: { video: PlayerLesson["video"]; title: string }) {
  if (!video) return null;
  if (video.kind !== "embed") {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-line bg-bg-subtle px-4 text-center text-mute">
        {video.kind === "processing" ? <Loader2 aria-hidden="true" className="size-8 animate-spin motion-reduce:animate-none" /> : <VideoOff aria-hidden="true" className="size-8" />}
        <p className="text-sm font-semibold">{video.kind === "processing" ? "This video is still being processed. Check back in a few minutes." : "This video isn't available right now."}</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-ink shadow-md">
      <iframe
        src={video.url}
        title={`Video: ${title}`}
        className="aspect-video w-full"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

