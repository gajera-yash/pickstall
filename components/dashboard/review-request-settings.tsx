"use client";

import { Eye, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Field } from "@/components/dashboard/editor-fields";
import { EmailTemplatePicker } from "@/components/dashboard/email-template-picker";
import { Hotspot } from "@/components/tours/hotspot";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveReviewRequestSettingsAction } from "@/lib/review-request/actions";
import { DEFAULT_REVIEW_BODY, DEFAULT_REVIEW_SUBJECT, REVIEW_EMAIL_LIMITS, renderReviewRequest } from "@/lib/review-request/rules";

/**
 * "Please review" email settings (D-117): on/off, optional subject and message, a preview, and how
 * many requests went out in the last 30 days.
 */
export function ReviewRequestSettings({ storeName, initial, sent, locked = false }: { storeName: string; initial: { enabled: boolean; subject: string; body: string }; sent: number; locked?: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [fieldError, setFieldError] = useState<{ field?: string; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const rendered = renderReviewRequest({ storeName, productTitle: "Your product", buyerName: "Asha", subject, body, reviewUrl: "(review link)" });

  const save = () =>
    startSave(async () => {
      setFieldError(null);
      const result = await saveReviewRequestSettingsAction({ enabled: enabled && !locked, subject, body });
      if (result.ok) {
        setMessage({ kind: "success", text: result.data.enabled ? "Saved. New buyers get one review request a week after they buy." : "Saved. Review requests are off." });
        router.refresh();
      } else {
        setFieldError({ field: result.field, text: result.error });
        setMessage(result.field ? null : { kind: "error", text: result.error });
      }
    });

  return (
    <section aria-labelledby="review-request" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-6">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
        <span className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
            <Star className="size-5" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span id="review-request" className="flex items-center gap-1.5 font-display text-h3">
              Review request
              <Hotspot id="new-review-request" />
            </span>
            <span className="text-sm text-mute">One email, a week after each purchase, asking the buyer to rate the product. Not sent if they already reviewed it, were refunded or unsubscribed.</span>
          </span>
        </span>
        <Switch checked={enabled && !locked} onCheckedChange={setEnabled} disabled={locked} aria-label="Send review requests" />
      </label>
      {locked && (
        <p className="text-sm text-mute">
          Part of Pro.{" "}
          <Link href="/dashboard/settings/plan" className="font-semibold text-blue underline underline-offset-4">
            Upgrade your plan
          </Link>{" "}
          to turn it on.
        </p>
      )}

      <p className="text-sm text-mute">
        Last 30 days: <span className="font-semibold text-ink tabular-nums">{sent.toLocaleString("en")}</span> {sent === 1 ? "request" : "requests"} sent.
      </p>

      <EmailTemplatePicker
        kind="review"
        ai={{ title: storeName, subject, body }}
        hasText={subject.trim() !== "" || body.trim() !== ""}
        onPick={(preset) => {
          setSubject(preset.subject);
          setBody(preset.body);
        }}
      />
      <Field id="review-subject" label="Subject (optional)" error={fieldError?.field === "subject" ? fieldError.text : null} hint={`Empty uses "${DEFAULT_REVIEW_SUBJECT}".`}>
        <Input id="review-subject" value={subject} maxLength={REVIEW_EMAIL_LIMITS.subject} placeholder={DEFAULT_REVIEW_SUBJECT} onChange={(event) => setSubject(event.target.value)} aria-invalid={fieldError?.field === "subject" ? true : undefined} />
      </Field>
      <Field id="review-body" label="Message (optional)" error={fieldError?.field === "body" ? fieldError.text : null} hint="{{customer_name}} and {{product_title}} can be used. The review button and your store name are always added.">
        <Textarea id="review-body" value={body} rows={5} maxLength={REVIEW_EMAIL_LIMITS.body} placeholder={DEFAULT_REVIEW_BODY} onChange={(event) => setBody(event.target.value)} aria-invalid={fieldError?.field === "body" ? true : undefined} />
      </Field>

      <Button type="button" variant="ghost" className="self-start" onClick={() => setPreview((open) => !open)} aria-expanded={preview}>
        <Eye aria-hidden="true" className="size-4" />
        {preview ? "Hide preview" : "Preview"}
      </Button>
      {preview && (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-bg-subtle p-4">
          <p className="text-sm font-semibold">{rendered.subject}</p>
          <pre className="font-sans text-sm whitespace-pre-wrap text-ink">{rendered.text}</pre>
        </div>
      )}

      {message && (
        <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Button type="button" className="self-end" onClick={save} loading={saving}>
        Save review request
      </Button>
    </section>
  );
}
