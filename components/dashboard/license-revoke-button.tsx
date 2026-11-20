"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { setOrderLicenseRevokedAction } from "@/lib/licenses/actions";

/** Revokes or restores an order's license key (D-114). */
export function LicenseRevokeButton({ orderId, revoked }: { orderId: string; revoked: boolean }) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = () => {
    setProblem(null);
    start(async () => {
      const result = await setOrderLicenseRevokedAction(orderId, !revoked);
      if (result.ok) router.refresh();
      else setProblem(result.error);
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant={revoked ? "secondary" : "ghost"} size="sm" onClick={toggle} loading={pending} className={revoked ? undefined : "text-danger"}>
        {revoked ? "Restore key" : "Revoke key"}
      </Button>
      {problem && <FieldError>{problem}</FieldError>}
    </div>
  );
}
