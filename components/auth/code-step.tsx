"use client";

import { CheckCircle2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import type { ResendCooldown } from "@/components/auth/use-resend-cooldown";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendEmailCode, verifyEmailCode, type SendCodeState, type VerifyCodeState } from "@/lib/auth/actions";
import { normalizeCodeInput } from "@/lib/auth/code";
import { OTP_LENGTH } from "@/lib/config";

type Props = {
  email: string;
  next: string;
  cooldown: ResendCooldown;
  onChangeEmail: () => void;
};

/**
 * The "enter your 6-digit code" step, shared by login and signup (DESIGN.md 9.1, 9.2, 13).
 * Auto-submits at 6 digits, keeps what the user typed after an error, resends with a cooldown.
 */
export function CodeStep({ email, next, cooldown, onChangeEmail }: Props) {
  const [resendState, resendAction, resending] = useActionState<SendCodeState, FormData>(sendEmailCode, null);
  const [verifyState, verifyAction, verifying] = useActionState<VerifyCodeState, FormData>(verifyEmailCode, null);
  const [code, setCode] = useState("");

  // Auto-submit once all digits are in. Runs after render, so the field already holds the cleaned value.
  const formRef = useRef<HTMLFormElement>(null);
  const submittedCode = useRef<string | null>(null);
  useEffect(() => {
    if (code.length < OTP_LENGTH) {
      submittedCode.current = null;
      return;
    }
    if (submittedCode.current !== code && !verifying) {
      submittedCode.current = code;
      formRef.current?.requestSubmit();
    }
  }, [code, verifying]);

  const verifyError = verifyState && !verifyState.ok ? verifyState.error : null;
  const resendError = resendState && !resendState.ok ? resendState.error : null;

  return (
    <>
      <p className="-mt-3 text-center text-mute" aria-live="polite">
        We sent a {OTP_LENGTH}-digit code to <strong className="font-semibold break-all text-ink">{email}</strong>.
      </p>

      <form ref={formRef} action={verifyAction} noValidate className="flex flex-col gap-6">
        <input type="hidden" name="email" value={email} />
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

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
        {cooldown.secondsLeft > 0 ? (
          <p className="text-sm text-mute">Resend code in {cooldown.secondsLeft}s</p>
        ) : (
          <form action={resendAction} onSubmit={cooldown.start}>
            <input type="hidden" name="email" value={email} />
            <Button type="submit" variant="link" loading={resending}>
              Resend code
            </Button>
          </form>
        )}
        <Button type="button" variant="link" onClick={onChangeEmail}>
          Use a different email
        </Button>
      </div>
      {resendState?.ok && (
        <p role="status" className="flex items-center justify-center gap-2 text-sm font-medium text-mint">
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          We sent a new code.
        </p>
      )}
      {resendError && <FieldError>{resendError}</FieldError>}
    </>
  );
}
