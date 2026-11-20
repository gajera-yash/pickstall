"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeAdminPasswordAction, type ChangePasswordState } from "@/lib/admin/login-actions";

/** The signed-in admin changes their password (D-108). */
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changeAdminPasswordAction, null);
  return (
    <form action={action} className="flex max-w-md flex-col gap-4" key={state?.ok ? "done" : "form"}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="current">Current password</Label>
        <Input id="current" name="current" type="password" autoComplete="current-password" required maxLength={200} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="next">New password</Label>
        <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={12} maxLength={200} />
        <span className="text-xs text-mute">At least 12 characters.</span>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">New password again</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={200} />
      </div>
      {state && (
        <Alert variant={state.ok ? "success" : "error"} role={state.ok ? "status" : "alert"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="self-start" loading={pending}>
        Change password
      </Button>
    </form>
  );
}
