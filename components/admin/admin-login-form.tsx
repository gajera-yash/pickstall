"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAdmin, type AdminLoginState } from "@/lib/admin/login-actions";

/** Admin username and password form (D-107). */
export function AdminLoginForm() {
  const [state, action, pending] = useActionState<AdminLoginState, FormData>(signInAdmin, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="admin-username">Username</Label>
        <Input id="admin-username" name="username" autoComplete="username" required maxLength={64} autoCapitalize="none" spellCheck={false} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="admin-password">Password</Label>
        <Input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </div>
      {state?.error && (
        <Alert variant="error" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
