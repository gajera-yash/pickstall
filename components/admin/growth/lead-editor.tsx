"use client";

import { MessageCircleMore, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/action-call";
import { deleteLeadAction, updateLeadAction } from "@/lib/marketing/lead-actions";
import { LEAD_STAGES, LEAD_STAGE_LABELS, LEAD_TEXT_MAX, type LeadStage } from "@/lib/marketing/leads-rules";

type Message = { kind: "success" | "error"; text: string } | null;

/** Stage, "contacted today", notes and delete for one lead (D-120). Every change is checked again on the server. */
export function LeadEditor({ leadId, stage, notes, handle }: { leadId: string; stage: LeadStage; notes: string | null; handle: string }) {
  const router = useRouter();
  const notesId = useId();
  const stageId = useId();
  const [currentStage, setCurrentStage] = useState<LeadStage>(stage);
  const [text, setText] = useState(notes ?? "");
  const [message, setMessage] = useState<Message>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const run = (work: () => Promise<{ ok: true; data: { message: string } } | { ok: false; error: string }>, after?: () => void, onError?: () => void) =>
    start(async () => {
      setMessage(null);
      const result = await callAction(work);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
        onError?.();
        return;
      }
      setMessage({ kind: "success", text: result.data.message });
      after?.();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5 sm:w-60">
          <label htmlFor={stageId} className="text-sm font-semibold">
            Stage
          </label>
          <ChoiceSelect
            id={stageId}
            value={currentStage}
            disabled={pending}
            onValueChange={(next) => {
              const value = next as LeadStage;
              const previous = currentStage;
              setCurrentStage(value);
              run(() => updateLeadAction({ action: "stage", leadId, stage: value }), undefined, () => setCurrentStage(previous));
            }}
            options={LEAD_STAGES.map((value) => ({ value, label: LEAD_STAGE_LABELS[value] }))}
          />
        </div>
        <Button type="button" variant="secondary" loading={pending} disabled={currentStage === "do_not_contact"} onClick={() => run(() => updateLeadAction({ action: "contacted", leadId }), () => currentStage === "new" && setCurrentStage("contacted"))}>
          <MessageCircleMore aria-hidden="true" className="size-4" />
          Mark contacted today
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={notesId} className="text-sm font-semibold">
          Notes
        </label>
        <Textarea id={notesId} value={text} maxLength={LEAD_TEXT_MAX.notes} rows={4} onChange={(event) => setText(event.target.value)} placeholder="What they said, what to follow up on..." />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-mute">
            {text.length.toLocaleString("en")} / {LEAD_TEXT_MAX.notes.toLocaleString("en")}
          </span>
          <Button type="button" size="sm" variant="secondary" loading={pending} disabled={text === (notes ?? "")} onClick={() => run(() => updateLeadAction({ action: "notes", leadId, notes: text }))}>
            Save notes
          </Button>
        </div>
      </div>

      {message && (
        <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="border-t border-line pt-4">
        <Button type="button" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 aria-hidden="true" className="size-4" />
          Delete lead
        </Button>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete @{handle}?</DialogTitle>
            <DialogDescription>The lead and its history are removed for good, and this handle will be skipped if it is in a list you import later.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const result = await callAction(() => deleteLeadAction({ leadId }));
                  if (!result.ok) {
                    setConfirmDelete(false);
                    setMessage({ kind: "error", text: result.error });
                    return;
                  }
                  router.push("/admin/growth");
                })
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
