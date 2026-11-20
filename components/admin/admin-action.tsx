"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { runAdminAction, type AdminActionInput } from "@/lib/admin/actions";

type Amount = { label: string; key: "days" | "months"; options: number[]; unit: string };

/**
 * One admin action behind a confirmation (D-105): a button opens a dialog that asks for a reason
 * (kept in the audit log) and, for trials and founding, how long. The server checks everything again.
 */
export function AdminAction({
  label,
  title,
  description,
  base,
  amount,
  destructive = false,
}: {
  label: string;
  title: string;
  description: string;
  base: AdminActionInput extends infer T ? (T extends { reason: string } ? Omit<T, "reason" | "days" | "months"> : never) : never;
  amount?: Amount;
  destructive?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [value, setValue] = useState(String(amount?.options[0] ?? ""));
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setProblem(null);
      const payload = { ...base, reason, ...(amount ? { [amount.key]: Number(value) } : {}) };
      const result = await runAdminAction(payload);
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      setOpen(false);
      setReason("");
      setDone(result.data.message);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant={destructive ? "destructive" : "secondary"} size="sm" onClick={() => (setDone(null), setOpen(true))}>
        {label}
      </Button>
      {done && (
        <span role="status" className="text-xs text-mint">
          {done}
        </span>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {amount && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-amount">{amount.label}</Label>
                <ChoiceSelect id="admin-amount" value={value} onValueChange={setValue} options={amount.options.map((option) => ({ value: String(option), label: `${option} ${amount.unit}` }))} />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-reason">Reason (kept in the audit log)</Label>
              <Textarea id="admin-reason" rows={3} maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why are you doing this?" />
            </div>
            {problem && (
              <Alert variant="error">
                <AlertDescription>{problem}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant={destructive ? "destructive" : "default"} onClick={run} loading={pending} disabled={reason.trim().length < 3}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
