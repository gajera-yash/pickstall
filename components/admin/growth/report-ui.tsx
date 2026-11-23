"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sendReportNowAction } from "@/lib/marketing/report-actions";

/** Builds today's report now and emails it if today's email was not sent yet (D-122). */
export function SendReportNow() {
  const router = useRouter();
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const result = await sendReportNowAction();
            if (!result.ok) return setMessage({ kind: "error", text: result.error });
            setMessage({ kind: "success", text: result.data.message });
            router.refresh();
          })
        }
      >
        <Send aria-hidden="true" className="size-4" />
        Send today&apos;s report now
      </Button>
      {message && (
        <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
