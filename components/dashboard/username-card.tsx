"use client";

import { Pencil } from "lucide-react";
import { useActionState, useState } from "react";

import { UsernameField } from "@/components/auth/username-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { USERNAME_CHANGE_RATE_LIMIT, storeLink } from "@/lib/config";
import { changeUsername, type ChangeUsernameState } from "@/lib/stores/actions";

/**
 * Store link with **Change** (PRD F8). The dialog reuses the live username check; the server
 * decides again (unique index, rate limit). The old link stops working at once, so the dialog says so.
 */
export function UsernameCard({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(username);
  const [state, action, pending] = useActionState<ChangeUsernameState, FormData>(changeUsername, null);
  const [changedTo, setChangedTo] = useState<string | null>(null);
  // A server error belongs to the name that was sent; it disappears once the name is edited.
  const [submitted, setSubmitted] = useState<string | null>(null);

  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) {
      setChangedTo(state.data.username);
      setOpen(false);
    }
  }

  const serverError = state && !state.ok && submitted === value ? state.error : null;
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setValue(username);
      setChangedTo(null);
    }
  };

  return (
    <Card id="store-link" className="scroll-mt-20 gap-4">
      <CardHeader>
        <h2 className="font-display text-h3">Store link</h2>
        <p className="text-sm text-mute">Your username is the last part of your link.</p>
      </CardHeader>

      {changedTo && (
        <Alert variant="success">
          <AlertDescription>
            Username changed. Your new link is <strong className="font-semibold break-all">{storeLink(changedTo)}</strong>.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex min-h-11 min-w-0 flex-1 items-center rounded-md bg-bg-subtle px-3 font-mono text-sm break-all text-ink">
          {storeLink(username)}
        </p>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button type="button" variant="secondary">
              <Pencil aria-hidden="true" />
              Change
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change your username</DialogTitle>
              <DialogDescription>You can change it {USERNAME_CHANGE_RATE_LIMIT.max} times a day.</DialogDescription>
            </DialogHeader>
            <form action={action} onSubmit={() => setSubmitted(value)} noValidate className="flex flex-col gap-5">
              <UsernameField value={value} onChange={setValue} serverError={serverError} autoFocus />
              <Alert variant="warning">
                <AlertDescription>Your old link stops working right away. Update it everywhere you shared it.</AlertDescription>
              </Alert>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" loading={pending} disabled={value === username || value.length === 0}>
                  {pending ? "Changing..." : "Change username"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!changedTo && (
        <p className="text-sm text-mute">Changing it frees your old username, so someone else could take it.</p>
      )}
    </Card>
  );
}
