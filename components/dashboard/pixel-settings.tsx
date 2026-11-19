"use client";

import { Radar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Field } from "@/components/dashboard/editor-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePixelsAction } from "@/lib/pixels/actions";
import type { StorePixels } from "@/lib/pixels/rules";

/**
 * Pixel IDs for the store's pages (D-097): Meta Pixel and Google tag. IDs only; visitors are asked
 * before any pixel loads. Leaving a field empty removes that pixel.
 */
export function PixelSettings({ initial }: { initial: StorePixels }) {
  const router = useRouter();
  const [meta, setMeta] = useState(initial.metaPixelId ?? "");
  const [google, setGoogle] = useState(initial.googleTagId ?? "");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [fieldError, setFieldError] = useState<{ field?: string; text: string } | null>(null);
  const [saving, startSave] = useTransition();

  const save = () =>
    startSave(async () => {
      setFieldError(null);
      const result = await savePixelsAction({ metaPixelId: meta, googleTagId: google });
      if (result.ok) {
        setMeta(result.data.metaPixelId ?? "");
        setGoogle(result.data.googleTagId ?? "");
        setMessage({ kind: "success", text: result.data.metaPixelId || result.data.googleTagId ? "Saved. Your store pages ask visitors before the pixels load." : "Saved. No pixels on your store." });
        router.refresh();
      } else {
        setFieldError({ field: result.field, text: result.error });
        setMessage(result.field ? null : { kind: "error", text: result.error });
      }
    });

  return (
    <section aria-labelledby="pixels-title" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
          <Radar className="size-5" />
        </span>
        <span className="flex flex-col gap-0.5">
          <h2 id="pixels-title" className="font-display text-h3">
            Pixels
          </h2>
          <span className="text-sm text-mute">
            Measure your ads: page views, checkouts and purchases on your store pages. Visitors are asked first, and nothing loads until they allow it.
          </span>
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="meta-pixel" label="Meta Pixel ID" error={fieldError?.field === "metaPixelId" ? fieldError.text : null} hint="Meta Events Manager > Data sources. Only the number.">
          <Input id="meta-pixel" value={meta} inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={20} placeholder="123456789012345" onChange={(event) => setMeta(event.target.value)} aria-invalid={fieldError?.field === "metaPixelId" ? true : undefined} />
        </Field>
        <Field id="google-tag" label="Google tag ID" error={fieldError?.field === "googleTagId" ? fieldError.text : null} hint="Google Analytics or Google Ads. Starts with G- or AW-.">
          <Input id="google-tag" value={google} autoComplete="off" spellCheck={false} maxLength={24} placeholder="G-ABC123XYZ" onChange={(event) => setGoogle(event.target.value.toUpperCase())} aria-invalid={fieldError?.field === "googleTagId" ? true : undefined} />
        </Field>
      </div>
      {message && (
        <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Button type="button" className="self-end" onClick={save} loading={saving}>
        Save pixels
      </Button>
    </section>
  );
}
