"use client";

import { Eye, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Field } from "@/components/dashboard/editor-fields";
import { EmailTemplatePicker } from "@/components/dashboard/email-template-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveCartSettingsAction } from "@/lib/abandoned-cart/actions";
import { CART_EMAIL_LIMITS, DEFAULT_CART_BODY, DEFAULT_CART_SUBJECT, renderCartReminder } from "@/lib/abandoned-cart/rules";

/**
 * Abandoned cart reminder settings (D-096): on/off, optional subject and message, a preview, and
 * how many reminders went out in the last 30 days and how many of those buyers then paid.
 */
export function CartReminderSettings({ storeName, initial, stats, locked = false }: { storeName: string; initial: { enabled: boolean; subject: string; body: string }; stats: { sent: number; recovered: number }; locked?: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [fieldError, setFieldError] = useState<{ field?: string; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const rendered = renderCartReminder({ storeName, productTitle: "Your product", buyerName: "Asha", subject, body, checkoutUrl: "(checkout link)" });

  const save = () =>
    startSave(async () => {
      setFieldError(null);
      const result = await saveCartSettingsAction({ enabled: enabled && !locked, subject, body });
      if (result.ok) {
        setMessage({ kind: "success", text: result.data.enabled ? "Saved. Unfinished checkouts get one reminder." : "Saved. Reminders are off." });
        router.refresh();
      } else {
        setFieldError({ field: result.field, text: result.error });
        setMessage(result.field ? null : { kind: "error", text: result.error });
      }
    });

  return (
    <section aria-labelledby="cart-reminder" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-6">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
        <span className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
            <ShoppingBag className="size-5" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span id="cart-reminder" className="font-display text-h3">
              Abandoned cart
            </span>
            <span className="text-sm text-mute">One email, two hours later, to buyers who started a paid checkout and didn&apos;t finish. It says it&apos;s the only reminder.</span>
          </span>
        </span>
        <Switch checked={enabled && !locked} onCheckedChange={setEnabled} disabled={locked} aria-label="Send abandoned cart reminders" />
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
        Last 30 days: <span className="font-semibold text-ink tabular-nums">{stats.sent.toLocaleString("en")}</span> {stats.sent === 1 ? "reminder" : "reminders"} sent,{" "}
        <span className="font-semibold text-ink tabular-nums">{stats.recovered.toLocaleString("en")}</span> then bought.
      </p>

      <EmailTemplatePicker
        kind="cart"
        ai={{ title: storeName, subject, body }}
        hasText={subject.trim() !== "" || body.trim() !== ""}
        onPick={(preset) => {
          setSubject(preset.subject);
          setBody(preset.body);
        }}
      />
      <Field id="cart-subject" label="Subject (optional)" error={fieldError?.field === "subject" ? fieldError.text : null} hint={`Empty uses "${DEFAULT_CART_SUBJECT}".`}>
        <Input id="cart-subject" value={subject} maxLength={CART_EMAIL_LIMITS.subject} placeholder={DEFAULT_CART_SUBJECT} onChange={(event) => setSubject(event.target.value)} aria-invalid={fieldError?.field === "subject" ? true : undefined} />
      </Field>
      <Field id="cart-body" label="Message (optional)" error={fieldError?.field === "body" ? fieldError.text : null} hint="{{customer_name}} and {{product_title}} can be used. The checkout button and your store name are always added.">
        <Textarea id="cart-body" value={body} rows={5} maxLength={CART_EMAIL_LIMITS.body} placeholder={DEFAULT_CART_BODY} onChange={(event) => setBody(event.target.value)} aria-invalid={fieldError?.field === "body" ? true : undefined} />
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
        Save reminder
      </Button>
    </section>
  );
}
