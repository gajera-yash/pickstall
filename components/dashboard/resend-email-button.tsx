"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { resendOrderEmail } from "@/lib/orders/email-actions";

/** Retries a buyer's access email that was not delivered. */
export function ResendEmailButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  const send = () => {
    setProblem(null);
    startTransition(async () => {
      const result = await resendOrderEmail(orderId);
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={send} loading={pending}>
        <Send aria-hidden="true" className="size-4" />
        Send again
      </Button>
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
    </div>
  );
}
