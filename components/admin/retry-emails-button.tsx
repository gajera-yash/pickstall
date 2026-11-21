"use client";

import { RotateCw } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { retryFailedOrderEmailsAction } from "@/lib/admin/email-actions";

/** "Send failed emails again": after the email setup is fixed, buyers get their access emails. */
export function RetryEmailsButton() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = () => {
    setMessage(null);
    start(async () => {
      const result = await retryFailedOrderEmailsAction();
      setMessage(result.ok ? { ok: result.data.sent === result.data.tried, text: `Tried ${result.data.tried} failed access emails; ${result.data.sent} sent.` } : { ok: false, text: result.error });
    });
  };
  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="secondary" size="sm" onClick={run} loading={pending}>
        {!pending && <RotateCw aria-hidden="true" className="size-4" />}
        Send failed access emails again
      </Button>
      {message && (
        <p role="status" className={message.ok ? "text-sm text-mint" : "text-sm text-danger"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
