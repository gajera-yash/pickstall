"use client";

import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { setStorePublishedAction } from "@/lib/stores/actions";

/** The wizard's last button: publish the store, then land on the full My Store dashboard. */
export function PublishButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  const publish = () => {
    setProblem(null);
    startTransition(async () => {
      const result = await setStorePublishedAction(true);
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" size="lg" onClick={publish} loading={pending}>
        <Rocket aria-hidden="true" />
        Publish my store
      </Button>
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
    </div>
  );
}
