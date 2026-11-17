"use client";

import { startTransition, useActionState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signOutOtherDevices, type SignOutOthersState } from "@/lib/account/actions";

/** "Sign out other devices" (D-075): keeps this browser signed in and ends every other session. */
export function SignOutOthers() {
  const [state, action, pending] = useActionState<SignOutOthersState, FormData>(signOutOtherDevices, null);

  return (
    <form
      action={action}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-3"
    >
      {state && (
        <Alert variant={state.ok ? "success" : "error"}>
          <AlertDescription>{state.ok ? "Done. Every other device and browser is now signed out." : state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" variant="secondary" className="self-start" disabled={pending}>
        {pending ? "Signing out…" : "Sign out other devices"}
      </Button>
    </form>
  );
}
