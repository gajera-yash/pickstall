import { describe, expect, it, vi } from "vitest";

// H2 (D-060): only video files start a lesson upload, whether picked or dropped on a lesson row.
vi.mock("@/lib/courses/curriculum-actions", () => ({ startLessonVideoUpload: vi.fn() }));

import { isVideoFile } from "@/components/dashboard/use-video-uploads";

describe("lesson video files", () => {
  it.each([
    [{ type: "video/mp4", name: "intro.mp4" }, true],
    [{ type: "video/quicktime", name: "intro.mov" }, true],
    [{ type: "", name: "intro.MKV" }, true],
    [{ type: "application/pdf", name: "slides.pdf" }, false],
    [{ type: "", name: "notes.txt" }, false],
    [{ type: "image/png", name: "cover.mp4.png" }, false],
  ])("%o is a video: %s", (file, expected) => {
    expect(isVideoFile(file)).toBe(expected);
  });
});
