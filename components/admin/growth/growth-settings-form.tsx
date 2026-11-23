"use client";

import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action-call";
import { saveGrowthSettingsAction } from "@/lib/marketing/draft-actions";
import { VOICE_EXAMPLES_MAX, VOICE_EXAMPLE_MAX, type GrowthSettings } from "@/lib/marketing/growth-settings-rules";

/** Voice examples and daily limits for DM drafts (D-121). Checked again on the server. */
export function GrowthSettingsForm({ initial }: { initial: GrowthSettings }) {
  const [examples, setExamples] = useState<string[]>(() => Array.from({ length: VOICE_EXAMPLES_MAX }, (_, index) => initial.voiceExamples[index] ?? ""));
  const [draftLimit, setDraftLimit] = useState(String(initial.dailyDraftLimit));
  const [contactTarget, setContactTarget] = useState(String(initial.dailyContactTarget));
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setMessage(null);
      const result = await callAction(() =>
        saveGrowthSettingsAction({
          voiceExamples: examples.map((text) => text.trim()).filter(Boolean),
          dailyDraftLimit: Number.parseInt(draftLimit, 10),
          dailyContactTarget: Number.parseInt(contactTarget, 10),
        }),
      );
      setMessage(result.ok ? { kind: "success", text: result.data.message } : { kind: "error", text: result.error });
    });

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <section aria-labelledby="voice-title" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 id="voice-title" className="font-display text-h4">
            Your voice
          </h2>
          <p className="text-sm text-mute">Paste up to {VOICE_EXAMPLES_MAX} DMs you wrote yourself. The AI matches their tone and length (the template ignores them). Leave out real names and links.</p>
        </div>
        {examples.map((text, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <label htmlFor={`voice-${index}`} className="text-sm font-semibold">
              Example {index + 1}
            </label>
            <Textarea
              id={`voice-${index}`}
              rows={3}
              maxLength={VOICE_EXAMPLE_MAX}
              value={text}
              onChange={(event) => setExamples(examples.map((value, i) => (i === index ? event.target.value : value)))}
            />
          </div>
        ))}
      </section>

      <section aria-labelledby="limits-title" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:p-6">
        <h2 id="limits-title" className="font-display text-h4">
          Daily limits
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-target" className="text-sm font-semibold">
              Creators to message per day
            </label>
            <Input id="contact-target" type="number" inputMode="numeric" min={1} max={100} value={contactTarget} onChange={(event) => setContactTarget(event.target.value)} />
            <span className="text-xs text-mute">10 to 15 personal messages a day keeps your account safe.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="draft-limit" className="text-sm font-semibold">
              Drafts written per day
            </label>
            <Input id="draft-limit" type="number" inputMode="numeric" min={1} max={200} value={draftLimit} onChange={(event) => setDraftLimit(event.target.value)} />
            <span className="text-xs text-mute">Caps AI use. Rewrites count too.</span>
          </div>
        </div>
      </section>

      {message && (
        <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="self-end" loading={pending}>
        Save settings
      </Button>
    </form>
  );
}
