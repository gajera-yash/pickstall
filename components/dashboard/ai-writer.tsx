"use client";

import { Sparkles } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { writeWithAiAction } from "@/lib/ai/actions";
import type { AiKind, AiTone, AiWriteResult } from "@/lib/ai/creator-writer";

const TONES: { value: AiTone; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "short", label: "Short" },
  { value: "excited", label: "Excited" },
];

/**
 * "Write with AI" (D-131): a small panel where the creator says what they want (optional) and picks
 * a tone; the AI writes a draft that replaces the text in the field, ready to edit. Nothing is saved.
 */
export function AiWriter({ kind, title, current, onResult, label = "Write with AI" }: { kind: AiKind; title: string; current: string; onResult: (result: AiWriteResult) => void; label?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [tone, setTone] = useState<AiTone>("friendly");
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const write = () =>
    start(async () => {
      setProblem(null);
      const result = await writeWithAiAction({ kind, title, notes, current, tone });
      if (!result.ok) return setProblem(result.error);
      onResult(result.data);
      setOpen(false);
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className="self-start">
          <Sparkles aria-hidden="true" className="size-4 text-blue" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-notes`}>What should it say? (optional)</Label>
          <Textarea id={`${id}-notes`} value={notes} rows={3} maxLength={500} placeholder="For example: 20% off this week, for beginners, includes 12 templates" onChange={(event) => setNotes(event.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-tone`}>Tone</Label>
          <ChoiceSelect id={`${id}-tone`} size="sm" value={tone} onValueChange={(value) => setTone(value as AiTone)} options={TONES} />
        </div>
        <p className="text-xs text-mute">{current ? "It improves your current text and replaces it in the field." : "It writes a first draft into the field."} Read it before you save; nothing is saved yet.</p>
        {problem && (
          <Alert variant="error" role="alert">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        )}
        <Button type="button" size="sm" onClick={write} loading={pending} className="self-end">
          {pending ? "Writing..." : "Write"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
