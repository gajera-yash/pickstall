"use client";

import { Download } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { importPlanInvoicesAction } from "@/lib/admin/billing-actions";

/** "Import past invoices from Stripe" (D-116): reads paid plan invoices once; safe to repeat. */
export function ImportInvoicesButton() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = () => {
    setMessage(null);
    start(async () => {
      const result = await importPlanInvoicesAction();
      setMessage(result.ok ? { ok: true, text: `Checked ${result.data.seen} paid invoices; ${result.data.added} were new.` } : { ok: false, text: result.error });
    });
  };
  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="secondary" size="sm" onClick={run} loading={pending}>
        {!pending && <Download aria-hidden="true" className="size-4" />}
        Import past invoices from Stripe
      </Button>
      {message && (
        <p role="status" className={message.ok ? "text-sm text-mint" : "text-sm text-danger"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
