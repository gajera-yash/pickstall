"use client";

import { AtSign, Mail, Phone, User } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState, type ReactNode } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CodeStep } from "@/components/auth/code-step";
import { useResendCooldown } from "@/components/auth/use-resend-cooldown";
import { WizardProgress } from "@/components/auth/wizard-progress";
import { Wordmark } from "@/components/brand/wordmark";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { IconInput } from "@/components/ui/icon-input";
import { Label } from "@/components/ui/label";
import { startSignup, type SignupState } from "@/lib/auth/actions";
import { OTP_LENGTH, ROOT_DOMAIN } from "@/lib/config";
import { PHONE_HINT } from "@/lib/phone";
import { normalizeSlugInput } from "@/lib/slug";
import type { SignupStep } from "@/lib/signup-steps";

const linkClass = "text-blue underline underline-offset-4 hover:text-blue-hover";

type FieldName = "username" | "fullName" | "email" | "phone";

/**
 * Signup steps 1 and 2: details, then the email code (shared CodeStep). After the code the user
 * goes to /onboarding (store basics). Fields are controlled so an error never clears what was typed.
 */
export function SignupFlow() {
  const [state, action, pending] = useActionState<SignupState, FormData>(startSignup, null);
  const cooldown = useResendCooldown();

  const [values, setValues] = useState({ username: "", fullName: "", email: "", phone: "" });
  const set = (field: FieldName, value: string) => setValues((current) => ({ ...current, [field]: value }));

  // "Use a different email" remembers which successful send to ignore, so no effect has to sync state.
  const [dismissed, setDismissed] = useState<SignupState>(null);
  const sentTo = state?.ok && state !== dismissed ? state.data.email : null;
  const step: SignupStep = sentTo ? "verify" : "account";

  const error = state && !state.ok ? state : null;
  const fieldError = (field: FieldName) => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;

  // Move focus to the field that has the problem, so keyboard and screen reader users land on it.
  useEffect(() => {
    if (state && !state.ok && state.field) document.getElementById(state.field)?.focus();
  }, [state]);

  const describedBy = (field: FieldName, hint?: boolean) =>
    fieldError(field) ? `${field}-error` : hint ? `${field}-hint` : undefined;

  return (
    <AuthShell top={<WizardProgress step={step} />}>
      <AuthHeading wordmark={<Wordmark />}>Create your account</AuthHeading>

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

          <form action={action} onSubmit={cooldown.start} noValidate className="flex flex-col gap-5">
            <Field id="username" label="Username" error={fieldError("username")} hint={`Your link: ${values.username || "yourname"}.${ROOT_DOMAIN}`}>
              <IconInput
                icon={AtSign}
                id="username"
                name="username"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="maya"
                required
                value={values.username}
                onChange={(event) => set("username", normalizeSlugInput(event.target.value))}
                aria-invalid={fieldError("username") ? true : undefined}
                aria-describedby={describedBy("username", true)}
              />
            </Field>

            <Field id="fullName" label="Full name" error={fieldError("fullName")}>
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
                aria-describedby={describedBy("fullName")}
              />
            </Field>

            <Field id="email" label="Email" error={fieldError("email")}>
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
                value={values.email}
                onChange={(event) => set("email", event.target.value)}
                aria-invalid={fieldError("email") ? true : undefined}
                aria-describedby={describedBy("email")}
              />
            </Field>

            <Field id="phone" label="Phone (optional)" error={fieldError("phone")} hint={PHONE_HINT}>
              <IconInput
                icon={Phone}
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+1 415 555 0100"
                value={values.phone}
                onChange={(event) => set("phone", event.target.value)}
                aria-invalid={fieldError("phone") ? true : undefined}
                aria-describedby={describedBy("phone", true)}
              />
            </Field>

            <Button type="submit" size="lg" className="mt-1 w-full" loading={pending}>
              Next
            </Button>
          </form>
        </>
      )}

      <div className="flex flex-col gap-3 text-center text-xs font-medium text-mute">
        <p>
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
        <p className="text-sm">
          Already have an account?{" "}
          <Link href="/login" className={linkClass}>
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

/** Label above the field, then the field, then the error (or the hint when there is no error). */
function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: FieldName;
  label: string;
  error: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint ? <FieldHint id={`${id}-hint`}>{hint}</FieldHint> : null}
    </div>
  );
}
