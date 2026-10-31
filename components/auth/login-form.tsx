"use client";

import { Mail } from "lucide-react";
import { useActionState, useState } from "react";

import { CodeStep } from "@/components/auth/code-step";
import { PasswordLoginForm } from "@/components/auth/password-login-form";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { useResendCooldown } from "@/components/auth/use-resend-cooldown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { IconInput } from "@/components/ui/icon-input";
import { Label } from "@/components/ui/label";
import { sendEmailCode, type SendCodeState } from "@/lib/auth/actions";
import { OTP_LENGTH } from "@/lib/config";

export type LoginNotice = { title: string; description: string };

type Props = { next: string; notice: LoginNotice | null; googleEnabled: boolean };

/**
 * Login: email, then the 6-digit code (shared CodeStep). Inputs are controlled so React 19's
 * automatic form reset never clears what the user typed.
 */
export function LoginForm({ next, notice, googleEnabled }: Props) {
  const [sendState, sendAction, sending] = useActionState<SendCodeState, FormData>(sendEmailCode, null);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"code" | "password">("code");
  const cooldown = useResendCooldown();

  // "Use a different email" remembers which successful send to ignore, so no effect has to sync state.
  const [dismissed, setDismissed] = useState<SendCodeState>(null);
  const sentTo = sendState?.ok && sendState !== dismissed ? sendState.data.email : null;
  const sendError = sendState && !sendState.ok ? sendState.error : null;

  if (sentTo) {
    return <CodeStep email={sentTo} next={next} cooldown={cooldown} onChangeEmail={() => setDismissed(sendState)} />;
  }

  const modeTabs = (
    <div role="group" aria-label="How to sign in" className="grid grid-cols-2 gap-1 rounded-md border border-line bg-bg-subtle p-1">
      {(["code", "password"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => setMode(value)}
          className={`min-h-10 cursor-pointer rounded-sm text-sm font-semibold ${mode === value ? "border border-blue bg-blue-soft text-ink" : "border border-transparent text-mute hover:text-ink"}`}
        >
          {value === "code" ? "Email code" : "Password"}
        </button>
      ))}
    </div>
  );

  if (mode === "password") {
    return (
      <>
        {modeTabs}
        <PasswordLoginForm next={next} onUseCode={() => setMode("code")} />
      </>
    );
  }

  return (
    <>
      {modeTabs}
      <p className="text-center text-mute" aria-live="polite">
        We&apos;ll email you a {OTP_LENGTH}-digit code. No password needed.
      </p>

      {notice && (
        <Alert variant="error">
          <AlertTitle>{notice.title}</AlertTitle>
          <AlertDescription>{notice.description}</AlertDescription>
        </Alert>
      )}

      <form action={sendAction} onSubmit={cooldown.start} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <IconInput
            icon={Mail}
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

      {googleEnabled && <GoogleSignIn next={next} />}
    </>
  );
}
