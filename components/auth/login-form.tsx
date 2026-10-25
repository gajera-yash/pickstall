"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sendEmailCode,
  signInWithGoogle,
  verifyEmailCode,
  type SendCodeState,
  type VerifyCodeState,
} from "@/lib/auth/actions";

// Functional placeholder: styled with DESIGN.md tokens in A2 / Block B.

type Props = { next: string; notice: string | null; googleEnabled: boolean };

export function LoginForm({ next, notice, googleEnabled }: Props) {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const [sendState, sendAction, sending] = useActionState(
    async (prev: SendCodeState, formData: FormData) => {
      const result = await sendEmailCode(prev, formData);
      if (result?.ok) setSentTo(result.data.email);
      return result;
    },
    null,
  );
  const [verifyState, verifyAction, verifying] = useActionState<VerifyCodeState, FormData>(verifyEmailCode, null);

  const sendError = sendState && !sendState.ok ? sendState.error : null;
  const verifyError = verifyState && !verifyState.ok ? verifyState.error : null;

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6">
        <p role="status" aria-live="polite">
          We sent a 6-digit code to <strong>{sentTo}</strong>. It expires in a few minutes.
        </p>

        <form action={verifyAction} className="flex flex-col gap-2" noValidate>
          <input type="hidden" name="email" value={sentTo} />
          <input type="hidden" name="next" value={next} />
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={9}
            required
            autoFocus
            aria-invalid={verifyError ? true : undefined}
            aria-describedby={verifyError ? "code-error" : undefined}
          />
          {verifyError && (
            <p id="code-error" role="alert" className="text-sm text-destructive">
              {verifyError}
            </p>
          )}
          <Button type="submit" disabled={verifying} aria-busy={verifying || undefined}>
            {verifying ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          <form action={sendAction}>
            <input type="hidden" name="email" value={sentTo} />
            <Button type="submit" variant="ghost" disabled={sending}>
              {sending ? "Sending..." : "Send a new code"}
            </Button>
          </form>
          <Button type="button" variant="ghost" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </div>
        {sendError && (
          <p role="alert" className="text-sm text-destructive">
            {sendError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      )}

      <form action={sendAction} className="flex flex-col gap-2" noValidate>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="maya@example.com"
          required
          aria-invalid={sendError ? true : undefined}
          aria-describedby={sendError ? "email-error" : "email-help"}
        />
        {sendError ? (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {sendError}
          </p>
        ) : (
          <p id="email-help" className="text-sm text-muted-foreground">
            We&apos;ll email you a 6-digit code. No password needed.
          </p>
        )}
        <Button type="submit" disabled={sending} aria-busy={sending || undefined}>
          {sending ? "Sending..." : "Send code"}
        </Button>
      </form>

      {googleEnabled && (
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="secondary" className="w-full">
            Continue with Google
          </Button>
        </form>
      )}
    </div>
  );
}
