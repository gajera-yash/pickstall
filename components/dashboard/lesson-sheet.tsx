"use client";

import { FileUp, Link2, Paperclip, Plus, Trash2, Upload, Video, VideoOff } from "lucide-react";
import { useRef, useState } from "react";

import { Field } from "@/components/dashboard/editor-fields";
import { RichTextEditor } from "@/components/dashboard/rich-text-editor";
import { uploadFile } from "@/components/dashboard/upload-file";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PRODUCT_FILE_MAX_BYTES } from "@/lib/config";
import type { VideoUpload } from "@/components/dashboard/use-video-uploads";
import { removeCourseAttachment, saveCourseLesson, type CurriculumResult } from "@/lib/courses/curriculum-actions";
import type { EditorLesson, EditorLessonVideo } from "@/lib/courses/curriculum-types";
import { COURSE_LIMITS } from "@/lib/courses/settings";
import { watchUrlFor } from "@/lib/courses/video-links";
import { PRODUCT_FILE_ACCEPT, formatBytes, type ProductFileInfo } from "@/lib/files/types";
import { docFromPlainText } from "@/lib/products/rich-text";

type VideoMode = "upload" | "link" | "none";

const BUNNY_STATUS: Record<Extract<EditorLessonVideo, { kind: "bunny" }>["status"], { label: string; variant: "testMode" | "live" | "danger" }> = {
  uploading: { label: "Uploading", variant: "testMode" },
  processing: { label: "Processing", variant: "testMode" },
  ready: { label: "Video ready", variant: "live" },
  failed: { label: "Upload failed", variant: "danger" },
};

export function videoBadge(video: EditorLessonVideo | null): { label: string; variant: "testMode" | "live" | "danger" | "draft" } | null {
  if (!video) return null;
  if (video.kind === "bunny") return BUNNY_STATUS[video.status];
  return { label: video.kind === "youtube" ? "YouTube" : "Vimeo", variant: "draft" };
}

/**
 * Edits one lesson in a side sheet (D-055): title, video (upload to Bunny, or a YouTube / Vimeo
 * link), written notes, files and links. "Save lesson" sends everything but the upload and the
 * files, which go up on their own as soon as they are picked.
 */
export function LessonSheet({
  courseId,
  lesson,
  videoUploadReady,
  fileUploadReady,
  onClose,
  onChange,
  onReload,
  videoUpload,
  onUploadVideo,
}: {
  courseId: string;
  lesson: EditorLesson;
  videoUploadReady: boolean;
  fileUploadReady: boolean;
  onClose: () => void;
  /** A fresh curriculum from the server after any change. */
  onChange: (result: CurriculumResult) => void;
  /** Asks the builder to fetch the curriculum again (after an upload that went outside our actions). */
  onReload: () => void;
  /** This lesson's video upload, held by the builder so the lesson row shows it too (H2, D-060). */
  videoUpload: VideoUpload | undefined;
  onUploadVideo: (file: File) => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [mode, setMode] = useState<VideoMode>(lesson.video === null ? "none" : lesson.video.kind === "bunny" ? "upload" : "link");
  const [videoLink, setVideoLink] = useState(lesson.video && lesson.video.kind !== "bunny" ? watchUrlFor(lesson.video) : "");
  const [bodyDoc, setBodyDoc] = useState(lesson.bodyDoc ?? docFromPlainText(""));
  const [links, setLinks] = useState(lesson.links);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<{ field?: string; text: string } | null>(null);
  const upload = videoUpload?.error === null ? { percent: videoUpload.percent } : null;
  const uploadProblem = videoUpload?.error ?? null;
  const videoInput = useRef<HTMLInputElement>(null);

  const fieldError = (field: string) => (problem?.field === field ? problem.text : null);

  const save = async () => {
    setSaving(true);
    setProblem(null);
    // "keep" leaves an uploaded video as it is; "" removes the video; otherwise a YouTube/Vimeo link.
    const link = mode === "link" ? videoLink.trim() : mode === "none" ? "" : "keep";
    const result = await saveCourseLesson(courseId, lesson.id, JSON.stringify({ title, bodyDoc, links, videoLink: link }));
    setSaving(false);
    if (!result.ok) {
      setProblem({ field: result.field, text: result.error });
      return;
    }
    onChange(result);
    onClose();
  };

  const current = lesson.video?.kind === "bunny" ? BUNNY_STATUS[lesson.video.status] : null;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit lesson</SheetTitle>
          <SheetDescription>Video, notes and resources for this lesson. Only students who bought the course can open them.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          {problem && !problem.field && (
            <Alert variant="error">
              <AlertDescription>{problem.text}</AlertDescription>
            </Alert>
          )}

          <Field id="lessonTitle" label="Lesson title" error={fieldError("title")} hint={`${title.length}/${COURSE_LIMITS.lessonTitle}`}>
            <Input id="lessonTitle" value={title} maxLength={COURSE_LIMITS.lessonTitle} onChange={(event) => setTitle(event.target.value)} aria-invalid={!!fieldError("title")} />
          </Field>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">Video</legend>
            <ToggleGroup type="single" variant="segment" aria-label="Video" value={mode} onValueChange={(value) => value && setMode(value as VideoMode)} className="grid w-full grid-cols-3">
              <ToggleGroupItem value="upload">
                <Upload aria-hidden="true" />
                Upload
              </ToggleGroupItem>
              <ToggleGroupItem value="link">
                <Link2 aria-hidden="true" />
                Link
              </ToggleGroupItem>
              <ToggleGroupItem value="none">
                <VideoOff aria-hidden="true" />
                None
              </ToggleGroupItem>
            </ToggleGroup>

            {mode === "upload" &&
              (videoUploadReady ? (
                <div className="flex flex-col gap-2">
                  <input
                    ref={videoInput}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.mkv"
                    className="sr-only"
                    onChange={(event) => {
                      const picked = event.target.files?.[0];
                      event.target.value = "";
                      if (picked) onUploadVideo(picked);
                    }}
                  />
                  {current && !upload && (
                    <p className="flex items-center gap-2 text-sm">
                      <Video aria-hidden="true" className="size-4 text-mute" />
                      This lesson has an uploaded video. <Badge variant={current.variant}>{current.label}</Badge>
                    </p>
                  )}
                  <Button type="button" variant="secondary" className="self-start" onClick={() => videoInput.current?.click()} disabled={upload !== null}>
                    <FileUp aria-hidden="true" className="size-4" />
                    {current ? "Replace video" : "Choose a video"}
                  </Button>
                  {upload && (
                    <div className="flex flex-col gap-1" role="status" aria-live="polite">
                      <Progress value={upload.percent} max={100} aria-label="Upload progress" />
                      <span className="text-xs text-mute">Uploading... {upload.percent}%. You can close this panel; keep the page open until it finishes.</span>
                    </div>
                  )}
                  {uploadProblem ? <FieldError>{uploadProblem}</FieldError> : <FieldHint>MP4, MOV or WebM. It is processed for every screen size; that takes a few minutes after the upload.</FieldHint>}
                </div>
              ) : (
                <Alert variant="info">
                  <AlertDescription>Video upload isn&apos;t set up yet. Use a YouTube or Vimeo link for now.</AlertDescription>
                </Alert>
              ))}

            {mode === "link" && (
              <Field id="videoLink" label="YouTube or Vimeo link" error={fieldError("videoLink")} hint="Unlisted videos work. Students watch it inside the course.">
                <Input id="videoLink" type="url" inputMode="url" value={videoLink} onChange={(event) => setVideoLink(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." aria-invalid={!!fieldError("videoLink")} />
              </Field>
            )}
          </fieldset>

          <RichTextEditor id="bodyDoc" label="Notes (optional)" value={bodyDoc} onChange={setBodyDoc} error={fieldError("bodyDoc")} maxChars={COURSE_LIMITS.notesChars} />

          <AttachmentsField courseId={courseId} lessonId={lesson.id} files={lesson.attachments} onChange={onChange} onReload={onReload} uploadReady={fileUploadReady} />

          <LinksField links={links} onChange={setLinks} error={fieldError("links")} />
        </SheetBody>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4 sm:px-6">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={save} loading={saving}>
            Save lesson
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Files students can download with the lesson (up to 5), uploaded as soon as they are picked. */
function AttachmentsField({
  courseId,
  lessonId,
  files,
  onChange,
  onReload,
  uploadReady,
}: {
  courseId: string;
  lessonId: string;
  files: ProductFileInfo[];
  onChange: (result: CurriculumResult) => void;
  onReload: () => void;
  uploadReady: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const full = files.length >= COURSE_LIMITS.attachmentsMax;

  const upload = (picked: File) => {
    setProblem(null);
    if (picked.size > PRODUCT_FILE_MAX_BYTES) {
      setProblem(`Use a file under ${PRODUCT_FILE_MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }
    setProgress(0);
    void uploadFile(`/api/courses/${courseId}/lessons/${lessonId}/attachments`, picked, setProgress).then((result) => {
      setProgress(null);
      if (result.ok) onReload();
      else setProblem(result.error);
    });
  };

  const remove = async (fileId: string) => {
    setRemoving(fileId);
    const result = await removeCourseAttachment(courseId, lessonId, fileId);
    setRemoving(null);
    if (result.ok) onChange(result);
    else setProblem(result.error);
  };

  return (
    <section aria-labelledby={`files-${lessonId}`} className="flex flex-col gap-2">
      <h3 id={`files-${lessonId}`} className="text-sm font-semibold">
        Files (optional)
      </h3>
      <input
        ref={input}
        type="file"
        accept={PRODUCT_FILE_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = "";
          if (picked) upload(picked);
        }}
      />
      {files.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-3 py-2">
              <Paperclip aria-hidden="true" className="size-4 shrink-0 text-blue" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">{file.name}</span>
                <span className="text-xs text-mute">
                  {file.label}, {formatBytes(file.size)}
                </span>
              </span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`} onClick={() => remove(file.id)} loading={removing === file.id} className="text-danger">
                {removing !== file.id && <Trash2 aria-hidden="true" className="size-4" />}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => input.current?.click()} disabled={!uploadReady || full || progress !== null}>
        <Plus aria-hidden="true" className="size-4" />
        Add a file
      </Button>
      {progress !== null && (
        <div className="flex flex-col gap-1" role="status" aria-live="polite">
          <Progress value={progress} max={100} aria-label="File upload progress" />
          <span className="text-xs text-mute">Uploading... {progress}%</span>
        </div>
      )}
      {problem ? <FieldError>{problem}</FieldError> : !uploadReady ? <FieldHint>File uploads aren&apos;t available on the live site yet. Add a link to the file under Links instead.</FieldHint> : <FieldHint>{full ? `That's the limit of ${COURSE_LIMITS.attachmentsMax} files.` : "PDFs, slides, source files and more, up to 200 MB each."}</FieldHint>}
    </section>
  );
}

/** Links to share with the lesson (a Figma file, a doc), https only. */
function LinksField({ links, onChange, error }: { links: { label: string; url: string }[]; onChange: (links: { label: string; url: string }[]) => void; error: string | null }) {
  const update = (index: number, patch: Partial<{ label: string; url: string }>) => onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  return (
    <section aria-labelledby="links-title" className="flex flex-col gap-2">
      <h3 id="links-title" className="text-sm font-semibold">
        Links (optional)
      </h3>
      {links.map((link, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-md border border-line p-3 sm:flex-row">
          <Input aria-label={`Link ${index + 1} name`} value={link.label} maxLength={COURSE_LIMITS.linkLabel} onChange={(event) => update(index, { label: event.target.value })} placeholder="Figma file" className="sm:w-40" />
          <Input aria-label={`Link ${index + 1} address`} type="url" inputMode="url" value={link.url} onChange={(event) => update(index, { url: event.target.value })} placeholder="https://" />
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove link ${index + 1}`} onClick={() => onChange(links.filter((_, i) => i !== index))} className="shrink-0 self-end text-danger sm:self-auto">
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ))}
      {links.length < COURSE_LIMITS.linksMax && (
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => onChange([...links, { label: "", url: "" }])}>
          <Plus aria-hidden="true" className="size-4" />
          Add a link
        </Button>
      )}
      {error ? <FieldError>{error}</FieldError> : <FieldHint>Links must start with https://</FieldHint>}
    </section>
  );
}
