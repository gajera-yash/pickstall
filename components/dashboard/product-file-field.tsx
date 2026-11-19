"use client";

import { FileUp, Paperclip, RefreshCw, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";

import { uploadFile } from "@/components/dashboard/upload-file";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { PRODUCT_FILE_MAX_BYTES } from "@/lib/config";
import { PRODUCT_FILE_ACCEPT, PRODUCT_FILE_LABELS, formatBytes, type ProductFileInfo } from "@/lib/files/types";

/**
 * Product file upload (D-050): pick a file, it uploads straight away with a progress bar, then
 * shows its name and size with Replace and Remove. The server checks the type from the file's
 * bytes and the size again; buyers only ever get it through their library after paying.
 */
export function ProductFileField({ productId, file, onChange }: { productId: string; file: ProductFileInfo | null; onChange: (file: ProductFileInfo | null) => void }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const busy = progress !== null || removing;

  const upload = (picked: File) => {
    setProblem(null);
    if (picked.size > PRODUCT_FILE_MAX_BYTES) {
      setProblem(`Use a file under ${PRODUCT_FILE_MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }
    setProgress(0);
    void uploadFile(`/api/products/${productId}/file`, picked, setProgress).then((result) => {
      setProgress(null);
      if (result.ok) onChange(result.file);
      else setProblem(result.error);
    });
  };

  const remove = async () => {
    setProblem(null);
    setRemoving(true);
    try {
      const response = await fetch(`/api/products/${productId}/file`, { method: "DELETE" });
      if (response.ok) onChange(null);
      else setProblem(((await response.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't remove that file. Try again.");
    } catch {
      setProblem("Couldn't remove that file. Check your connection and try again.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={PRODUCT_FILE_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = "";
          if (picked) upload(picked);
        }}
      />
      {file ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-bg-subtle px-4 py-3">
          <Paperclip aria-hidden="true" className="size-5 shrink-0 text-blue" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">{file.name}</span>
            <span className="text-xs text-mute">
              {file.label}, {formatBytes(file.size)}
            </span>
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Replace
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={remove} loading={removing} disabled={busy} className="text-danger">
            <Trash2 aria-hidden="true" className="size-4" />
            Remove
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="h-auto min-h-28 w-full flex-col gap-2 border-dashed px-4 py-6 text-center whitespace-normal"
        >
          <FileUp aria-hidden="true" className="size-6 text-blue" />
          <span className="font-semibold">Choose a file to upload</span>
          <span className="text-xs text-mute">
            {PRODUCT_FILE_LABELS}. Up to {PRODUCT_FILE_MAX_BYTES / 1024 / 1024} MB.
          </span>
        </Button>
      )}
      {progress !== null && (
        <div className="flex flex-col gap-1" role="status" aria-live="polite">
          <Progress value={progress} max={100} aria-label="Upload progress" />
          <span className="text-xs text-mute">Uploading... {progress}%</span>
        </div>
      )}
      {problem ? <FieldError>{problem}</FieldError> : <FieldHint>Buyers download it from their library after paying. It is never public.</FieldHint>}
    </div>
  );
}
