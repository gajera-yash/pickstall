"use client";

import { ArrowRight, User } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CodeStep } from "@/components/auth/code-step";
import { EmailField } from "@/components/auth/email-field";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { PhoneField } from "@/components/auth/phone-field";
import { useResendCooldown } from "@/components/auth/use-resend-cooldown";
import { UsernameField } from "@/components/auth/username-field";
import { WizardProgress } from "@/components/auth/wizard-progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, describedBy } from "@/components/ui/form-field";
import { IconInput } from "@/components/ui/icon-input";
import { startSignup, type SignupState } from "@/lib/auth/actions";
import { OTP_LENGTH } from "@/lib/config";
import type { SignupStep } from "@/lib/signup-steps";

const linkClass = "text-blue underline underline-offset-4 hover:text-blue-hover";

type FieldName = "username" | "fullName" | "email";

/**
 * Signup steps 1 and 2: details, then the email code (shared CodeStep). After the code the user
 * gets a draft store and goes straight to /dashboard. Fields are controlled so an error never clears what was typed.
 */
/** `googleNext` is where Google sends a returning user; null hides the Google button. */
export function SignupFlow({ googleNext, initialUsername = "" }: { googleNext: string | null; initialUsername?: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(startSignup, null);
  const cooldown = useResendCooldown();

  const [values, setValues] = useState({ username: initialUsername, fullName: "", email: "" });
  const set = (field: FieldName, value: string) => setValues((current) => ({ ...current, [field]: value }));

  // "Use a different email" remembers which successful send to ignore, so no effect has to sync state.
  const [dismissed, setDismissed] = useState<SignupState>(null);
  const sentTo = state?.ok && state !== dismissed ? state.data.email : null;
  const step: SignupStep = sentTo ? "code" : "details";

  const error = state && !state.ok ? state : null;
  const fieldError = (field: FieldName | "phone") => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;

  // Move focus to the field that has the problem, so keyboard and screen reader users land on it.
  useEffect(() => {
    if (state && !state.ok && state.field) document.getElementById(state.field)?.focus();
  }, [state]);

  return (
    <AuthShell
      top={<WizardProgress step={step} />}
      footer={
        <>
          <p className="text-sm font-medium text-ink">
            Already have an account?{" "}
            <Link href="/login" className={linkClass}>
              Log in
            </Link>
          </p>
          <p className="text-xs font-medium text-mute">
            By continuing you agree to the{" "}
            <Link href="/terms" className={linkClass}>
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className={linkClass}>
              Privacy Policy
            </Link>
            .
          </p>
        </>
      }
    >
      <AuthHeading>{sentTo ? "Check your email" : "Create your account"}</AuthHeading>

      {sentTo ? (
        <CodeStep email={sentTo} next="/" cooldown={cooldown} onChangeEmail={() => setDismissed(state)} />
      ) : (
        <>
          <p className="-mt-3 text-center text-mute">
            Claim your link and start selling. We&apos;ll email you a {OTP_LENGTH}-digit code, no password.
          </p>

          {formError && (
            <Alert variant="error">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {/* Submits by hand so React 19 does not reset the form after the action: on an error the
              creator keeps what they typed (the inputs are controlled). Without JavaScript the action still runs. */}
          <form
            action={action}
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              cooldown.start();
              const data = new FormData(event.currentTarget);
              startTransition(() => action(data));
            }}
            noValidate
            className="flex flex-col gap-5"
          >
            <UsernameField
              value={values.username}
              onChange={(username) => set("username", username)}
              serverError={fieldError("username")}
            />

            <FormField id="fullName" label="Full name" error={fieldError("fullName")}>
              <IconInput
                icon={User}
                id="fullName"
                name="fullName"
                autoComplete="name"
                placeholder="Maya Patel"
                required
                value={values.fullName}
                onChange={(event) => set("fullName", event.target.value)}
                aria-invalid={fieldError("fullName") ? true : undefined}
                aria-describedby={describedBy("fullName", fieldError("fullName"))}
              />
            </FormField>

            <EmailField value={values.email} onChange={(email) => set("email", email)} serverError={fieldError("email")} />

            <PhoneField error={fieldError("phone")} />

            <Button type="submit" size="lg" className="mt-1 w-full" loading={pending}>
              Send my code
              <ArrowRight aria-hidden="true" className="size-5" />
            </Button>
          </form>

          {googleNext && <GoogleSignIn next={googleNext} />}
        </>
      )}
    </AuthShell>
  );
}
