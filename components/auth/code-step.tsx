"use client";

import { CheckCircle2, MailCheck } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { OtpInput } from "@/components/auth/otp-input";
import type { ResendCooldown } from "@/components/auth/use-resend-cooldown";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { sendEmailCode, verifyEmailCode, type SendCodeState, type VerifyCodeState } from "@/lib/auth/actions";
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
      <div className="-mt-2 flex flex-col items-center gap-3 text-center">
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-blue-soft text-blue">
          <MailCheck className="size-6" />
        </span>
        <p className="text-mute" aria-live="polite">
          We sent a {OTP_LENGTH}-digit code to <strong className="font-semibold break-all text-ink">{email}</strong>.
        </p>
      </div>

      <form ref={formRef} action={verifyAction} noValidate className="flex flex-col gap-6">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="code" value={code} />
        <div className="flex flex-col gap-3">
          <p id="code-label" className="text-center text-sm font-semibold text-ink">
            Enter the {OTP_LENGTH}-digit code
          </p>
          <OtpInput
            value={code}
            onChange={setCode}
            labelledBy="code-label"
            describedBy={verifyError ? "code-error" : undefined}
            invalid={Boolean(verifyError)}
            disabled={verifying}
          />
          {verifyError && (
            <FieldError id="code-error" className="justify-center">
              {verifyError}
            </FieldError>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={verifying} disabled={code.length < OTP_LENGTH}>
          Verify and continue
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
