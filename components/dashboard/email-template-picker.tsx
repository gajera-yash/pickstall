"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EMAIL_PRESETS, type EmailKind, type EmailPreset } from "@/lib/email/presets";

/**
 * "Start from a template" (D-124): ready-made texts for this email. Picking one fills the subject
 * and message, which the creator can then change; nothing is saved until they save.
 */
export function EmailTemplatePicker({ kind, onPick, hasText }: { kind: EmailKind; onPick: (preset: EmailPreset) => void; hasText: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles aria-hidden="true" className="size-4 text-blue" />
        Start from a template
      </p>
      <div role="group" aria-label="Email templates" className="flex flex-wrap gap-2">
        {EMAIL_PRESETS[kind].map((preset) => (
          <Button key={preset.id} type="button" variant="secondary" size="sm" onClick={() => onPick(preset)}>
            {preset.name}
          </Button>
        ))}
      </div>
      {hasText && <p className="text-xs text-mute">A template replaces the subject and message below. Nothing is saved until you save.</p>}
    </div>
  );
}
