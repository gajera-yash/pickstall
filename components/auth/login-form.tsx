"use client";

import { CheckCircle2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sendEmailCode,
  signInWithGoogle,
  verifyEmailCode,
  type SendCodeState,
  type VerifyCodeState,
} from "@/lib/auth/actions";
import { normalizeCodeInput, secondsRemaining } from "@/lib/auth/code";
import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/config";

export type LoginNotice = { title: string; description: string };

type Props = { next: string; notice: LoginNotice | null; googleEnabled: boolean };

/**
 * Two steps in one card: email, then the 6-digit code (DESIGN.md 9.1, 9.2, 9.11, 13).
 * Inputs are controlled so React 19's automatic form reset never clears what the user typed.
 */
export function LoginForm({ next, notice, googleEnabled }: Props) {
  const [sendState, sendAction, sending] = useActionState<SendCodeState, FormData>(sendEmailCode, null);
  const [resendState, resendAction, resending] = useActionState<SendCodeState, FormData>(sendEmailCode, null);
  const [verifyState, verifyAction, verifying] = useActionState<VerifyCodeState, FormData>(verifyEmailCode, null);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  // "Use a different email" remembers which successful send to ignore, so no effect has to sync state.
  const [dismissed, setDismissed] = useState<SendCodeState>(null);
  const sentTo = sendState?.ok && sendState !== dismissed ? sendState.data.email : null;

  // Resend cooldown. `now` only changes inside the interval callback and the submit handlers.
  const [cooldownEndsAt, setCooldownEndsAt] = useState(0);
  const [now, setNow] = useState(0);
  const secondsLeft = secondsRemaining(cooldownEndsAt, now);
  const cooling = secondsLeft > 0;

  useEffect(() => {
    if (!cooling) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooling]);

  function startCooldown() {
    const t = Date.now();
    setNow(t);
    setCooldownEndsAt(t + OTP_RESEND_COOLDOWN_SECONDS * 1000);
  }

  // Auto-submit once all digits are in. Runs after render, so the field already holds the cleaned value.
  const verifyFormRef = useRef<HTMLFormElement>(null);
  const submittedCode = useRef<string | null>(null);
  useEffect(() => {
    if (code.length < OTP_LENGTH) {
      submittedCode.current = null;
      return;
    }
    if (submittedCode.current !== code && !verifying) {
      submittedCode.current = code;
      verifyFormRef.current?.requestSubmit();
    }
  }, [code, verifying]);

  function changeEmail() {
    setDismissed(sendState);
    setCode("");
  }

  const sendError = sendState && !sendState.ok ? sendState.error : null;
  const resendError = resendState && !resendState.ok ? resendState.error : null;
  const verifyError = verifyState && !verifyState.ok ? verifyState.error : null;

  if (sentTo) {
    return (
      <>
        <p className="-mt-2 text-mute" aria-live="polite">
          We sent a {OTP_LENGTH}-digit code to <strong className="font-semibold break-all text-ink">{sentTo}</strong>.
        </p>

        <form ref={verifyFormRef} action={verifyAction} noValidate className="flex flex-col gap-6">
          <input type="hidden" name="email" value={sentTo} />
          <input type="hidden" name="next" value={next} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">{OTP_LENGTH}-digit code</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              required
              autoFocus
              value={code}
              onChange={(event) => setCode(normalizeCodeInput(event.target.value))}
              className="h-14 text-center text-h3 tracking-[0.3em] tabular-nums"
              aria-invalid={verifyError ? true : undefined}
              aria-describedby={verifyError ? "code-error" : undefined}
            />
            {verifyError && <FieldError id="code-error">{verifyError}</FieldError>}
          </div>
          <Button type="submit" size="lg" className="w-full" loading={verifying}>
            Sign in
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          {cooling ? (
            <p className="text-sm text-mute">Resend code in {secondsLeft}s</p>
          ) : (
            <form action={resendAction} onSubmit={startCooldown}>
              <input type="hidden" name="email" value={sentTo} />
              <Button type="submit" variant="link" loading={resending}>
                Resend code
              </Button>
            </form>
          )}
          <Button type="button" variant="link" onClick={changeEmail}>
            Use a different email
          </Button>
        </div>
        {resendState?.ok && (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-mint">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            We sent a new code.
          </p>
        )}
        {resendError && <FieldError>{resendError}</FieldError>}
      </>
    );
  }

  return (
    <>
      <p className="-mt-2 text-mute" aria-live="polite">
        We&apos;ll email you a {OTP_LENGTH}-digit code. No password.
      </p>

      {notice && (
        <Alert variant="error">
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.description}</AlertDescription>
        </Alert>
      )}

      <form action={sendAction} onSubmit={startCooldown} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="maya@example.com"
            required
            autoFocus={dismissed !== null}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={sendError ? true : undefined}
            aria-describedby={sendError ? "email-error" : undefined}
          />
          {sendError && <FieldError id="email-error">{sendError}</FieldError>}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={sending}>
          Continue
        </Button>
      </form>

      {googleEnabled && (
        <>
          <div aria-hidden="true" className="flex items-center gap-3 text-sm text-mute">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <GoogleButton />
          </form>
        </>
      )}
    </>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="lg" className="w-full" loading={pending}>
      Continue with Google
    </Button>
  );
}
