"use client";

import { Download, Trash2 } from "lucide-react";
import { startTransition, useActionState, useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount, type DeleteAccountState } from "@/lib/account/actions";

/**
 * "Download my data" and "Delete account" (D-074), for creators (Settings > Account) and buyers
 * (/account). The download is a plain link to the export route; deleting needs DELETE typed in.
 */
export function AccountData({ hasStore }: { hasStore: boolean }) {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(deleteAccount, null);
  const [confirm, setConfirm] = useState("");
  const error = state && !state.ok ? state : null;

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="font-display text-h3">Your data</h2>
          <p className="text-sm text-mute">
            Download everything we hold about you{hasStore ? ": your profile, store, products, sales and purchases" : ": your profile and purchases"}, as a
            JSON file.
          </p>
        </CardHeader>
        <Button asChild variant="secondary" className="self-start">
          <a href="/account/export" download>
            <Download aria-hidden="true" />
            Download my data
          </a>
        </Button>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-h3">Delete account</h2>
          <p className="text-sm text-mute">This cannot be undone. When you delete your account:</p>
        </CardHeader>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-mute">
          {hasStore && <li>a paid plan is cancelled at once and you are not charged again;</li>}
          {hasStore && <li>your store goes offline, its link is freed, and Stripe is disconnected;</li>}
          {hasStore && <li>buyers keep access to what they already bought, and orders are kept as tax law requires;</li>}
          <li>your name, phone and sign-in are deleted, and you are signed out everywhere.</li>
        </ul>

        {error && !error.field && (
          <Alert variant="error">
            <AlertDescription>{error.error}</AlertDescription>
          </Alert>
        )}

        <form
          action={action}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(() => action(data));
          }}
          className="flex flex-col gap-3"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm">Type DELETE to confirm</Label>
            <Input
              id="confirm"
              name="confirm"
              autoComplete="off"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              aria-invalid={error?.field === "confirm" ? true : undefined}
              aria-describedby={error?.field === "confirm" ? "confirm-error" : undefined}
              className="max-w-xs"
            />
            {error?.field === "confirm" && <FieldError id="confirm-error">{error.error}</FieldError>}
          </div>
          <Button type="submit" variant="destructive" className="self-start" disabled={confirm !== "DELETE"} loading={pending}>
            <Trash2 aria-hidden="true" />
            Delete my account
          </Button>
        </form>
      </Card>
    </>
  );
}
