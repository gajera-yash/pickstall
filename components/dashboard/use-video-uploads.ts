"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { startLessonVideoUpload } from "@/lib/courses/curriculum-actions";

// Lesson video uploads for the curriculum builder (D-055, H2 D-060): the server signs the upload,
// then the browser sends the file straight to Bunny with tus. The state is per lesson, so the
// lesson row and the lesson panel show the same progress.

export type VideoUpload = { percent: number; error: null } | { percent: null; error: string };

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|mkv|m4v|avi)$/i;

/** True for a file that looks like a video (by type, or by name when the browser gives no type). */
export function isVideoFile(file: Pick<File, "type" | "name">): boolean {
  return file.type.startsWith("video/") || (file.type === "" && VIDEO_EXTENSIONS.test(file.name));
}

export function useVideoUploads(courseId: string, onUploaded: () => void) {
  const [uploads, setUploads] = useState<Record<string, VideoUpload>>({});
  // The latest callback, without restarting uploads when it changes.
  const uploaded = useRef(onUploaded);
  useEffect(() => {
    uploaded.current = onUploaded;
  }, [onUploaded]);
  const busy = Object.values(uploads).some((upload) => upload.error === null);

  const set = (lessonId: string, upload: VideoUpload | null) =>
    setUploads((current) => {
      const next = { ...current };
      if (upload) next[lessonId] = upload;
      else delete next[lessonId];
      return next;
    });

  const start = useCallback(
    async (lessonId: string, title: string, file: File) => {
      if (!isVideoFile(file)) {
        set(lessonId, { percent: null, error: "Choose a video file (MP4, MOV or WebM)." });
        return;
      }
      set(lessonId, { percent: 0, error: null });
      const ticket = await startLessonVideoUpload(courseId, lessonId, title || file.name);
      if (!ticket.ok) {
        set(lessonId, { percent: null, error: ticket.error });
        return;
      }
      // Loaded only when a video is picked.
      const { Upload } = await import("tus-js-client");
      new Upload(file, {
        endpoint: ticket.data.endpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          AuthorizationSignature: ticket.data.signature,
          AuthorizationExpire: String(ticket.data.expires),
          VideoId: ticket.data.videoId,
          LibraryId: ticket.data.libraryId,
        },
        metadata: { filetype: file.type || "video/mp4", title: title || file.name },
        onProgress: (sent, total) => set(lessonId, { percent: total > 0 ? Math.round((sent / total) * 100) : 0, error: null }),
        onError: () => set(lessonId, { percent: null, error: "The upload stopped. Check your connection and try again." }),
        onSuccess: () => {
          set(lessonId, null);
          uploaded.current();
        },
      }).start();
    },
    [courseId],
  );

  const dismiss = useCallback((lessonId: string) => set(lessonId, null), []);

  // Leaving the page would stop an upload: the browser asks first.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  return { uploads, start, dismiss, busy };
}
