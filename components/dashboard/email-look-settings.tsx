"use client";

import { Check, Palette } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Hotspot } from "@/components/tours/hotspot";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { saveEmailLookAction } from "@/lib/email/look-actions";
import { EMAIL_LOOKS, EMAIL_LOOK_LABELS, paragraphsHtml, renderLook, type EmailLook } from "@/lib/email/looks";
import { cn } from "@/lib/utils";

const SAMPLE = "Hi Asha,\n\nThanks for your purchase of Freelancer budget workbook. Your order is confirmed.\n\nReply to this email if you have any questions.";

/**
 * Email design (D-124): one look for every email the creator writes, in their store's accent, with a
 * live preview. The preview is the real email HTML in a sandboxed frame (no scripts, no links).
 */
export function EmailLookSettings({ initial, accent, storeName }: { initial: EmailLook | null; accent: string; storeName: string }) {
  const router = useRouter();
  const [look, setLook] = useState<EmailLook>(initial ?? "card");
  const [saved, setSaved] = useState<EmailLook | null>(initial);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const html = renderLook({ look, accent, storeName, contentHtml: paragraphsHtml(SAMPLE, accent), button: { label: "Open your purchase", url: "https://example.com" }, footerHtml: `Sent for ${storeName.replace(/[<>&"']/g, "")} through Pickstall.` });

  const save = () =>
    startSave(async () => {
      const result = await saveEmailLookAction(look);
      if (result.ok) {
        setSaved(look);
        setMessage({ kind: "success", text: "Saved. Your emails use this design now." });
        router.refresh();
      } else setMessage({ kind: "error", text: result.error });
    });

  return (
    <section aria-labelledby="email-look" className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
          <Palette className="size-5" />
        </span>
        <span className="flex flex-col gap-0.5">
          <h2 id="email-look" className="flex items-center gap-1.5 font-display text-h3">
            Email design
            <Hotspot id="new-email-design" />
          </h2>
          <span className="text-sm text-mute">One look for all your emails: order confirmation, welcome, broadcasts, abandoned cart and review request. Buttons use your accent color.</span>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div role="radiogroup" aria-label="Email design" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {EMAIL_LOOKS.map((value) => {
            const on = value === look;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setLook(value);
                  setMessage(null);
                }}
                className={cn("flex min-h-11 items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-blue focus-visible:outline-none", on ? "border-blue bg-blue-soft" : "border-line hover:bg-bg-subtle")}
              >
                <span aria-hidden="true" className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border", on ? "border-blue bg-blue text-white" : "border-line")}>
                  {on && <Check className="size-3.5" />}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{EMAIL_LOOK_LABELS[value].name}</span>
                  <span className="text-sm text-mute">{EMAIL_LOOK_LABELS[value].description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <iframe title={`Preview of the ${EMAIL_LOOK_LABELS[look].name} email design`} srcDoc={html} sandbox="" className="h-[420px] w-full rounded-md border border-line bg-white" />
      </div>

      {message && (
        <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Button type="button" className="self-end" onClick={save} loading={saving} disabled={look === saved}>
        Save email design
      </Button>
    </section>
  );
}
