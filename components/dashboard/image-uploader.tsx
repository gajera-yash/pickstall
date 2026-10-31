"use client";

import { ImagePlus, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { MEDIA_MAX_BYTES, safeImageSrc, type MediaKind } from "@/lib/media/media";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: string;
  kind: MediaKind;
  /** Current image path (`/media/...`, or an old https link). Empty string when there is none. */
  value: string;
  onChange: (value: string) => void;
  /** Error from a failed save. */
  error?: string | null;
  hint?: string;
  /** Round preview (profile photo) or wide (cover). */
  shape?: "round" | "wide";
};

/**
 * Picks an image from the user's device and uploads it to our server (D-032). Shows a preview, the
 * progress state and clear errors; the checks are repeated on the server. Remove clears the field
 * (the saved image changes when the form is saved).
 */
export function ImageUploader({ id, label, kind, value, onChange, error, hint, shape = "round" }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const preview = safeImageSrc(value);

  const upload = async (file: File) => {
    setProblem(null);
    if (file.size > MEDIA_MAX_BYTES) return setProblem(`Use an image under ${MEDIA_MAX_BYTES / 1024 / 1024} MB.`);
    if (!file.type.startsWith("image/")) return setProblem("Use a JPG, PNG, WebP or GIF image.");

    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("kind", kind);
      const response = await fetch("/api/uploads", { method: "POST", body });
      const json = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !json?.url) return setProblem(json?.error ?? "Couldn't upload that image. Try again.");
      onChange(json.url);
    } catch {
      setProblem("Couldn't upload. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const shown = problem ?? error ?? null;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden border border-line bg-bg-subtle text-mute",
            shape === "round" ? "size-20 rounded-full" : "aspect-video w-40 rounded-md",
          )}
        >
          {preview ? (
            // The creator's own upload (or an old https link), so next/image's fixed remote hosts cannot be used.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6" />
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Upload aria-hidden="true" className="size-4" />}
            {busy ? "Uploading..." : preview ? "Change image" : "Upload image"}
          </Button>
          {preview && !busy && (
            <Button type="button" variant="ghost" onClick={() => onChange("")}>
              <Trash2 aria-hidden="true" className="size-4" />
              Remove
            </Button>
          )}
        </div>
      </div>
      <div aria-live="polite">
        {shown ? <FieldError id={`${id}-error`}>{shown}</FieldError> : <FieldHint id={`${id}-hint`}>{hint ?? "JPG, PNG, WebP or GIF, up to 5 MB."}</FieldHint>}
      </div>
    </div>
  );
}
