"use client";

import { ArrowRight, User } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";

import { PhoneField } from "@/components/auth/phone-field";
import { TermsCheckbox } from "@/components/auth/terms-checkbox";
import { UsernameField } from "@/components/auth/username-field";
import { SignupSourceFields } from "@/components/marketing/signup-source";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, describedBy } from "@/components/ui/form-field";
import { IconInput } from "@/components/ui/icon-input";
import { claimUsername, type ClaimUsernameState } from "@/lib/auth/actions";

const linkClass = "text-blue underline underline-offset-4 hover:text-blue-hover";

/**
 * Choose a username (D-020, reference docs/ui-reference/username.webp): new Google users, users
 * without a store, or when the signup username was taken. Creates the draft store, then goes to
 * the dashboard.
 */
export function UsernameStep({ needsName, taken }: { needsName: boolean; taken: boolean }) {
  const [state, action, pending] = useActionState<ClaimUsernameState, FormData>(claimUsername, null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");

  const error = state && !state.ok ? state : null;
  const fieldError = (field: string) => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;

  useEffect(() => {
    if (state && !state.ok && state.field) document.getElementById(state.field)?.focus();
  }, [state]);

  return (
    <>
      {taken && (
        <Alert variant="warning">
          <AlertTitle>That username was just taken</AlertTitle>
          <AlertDescription>Someone claimed it while you were signing up. Choose another one.</AlertDescription>
        </Alert>
      )}
      {formError && (
        <Alert variant="error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {/* Submitted by hand so an error does not clear the fields (see SignupFlow). */}
      <form
        action={action}
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => action(data));
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        {/* Reached back from Google sign-in, so this page's referrer is not a source (D-119). */}
        <SignupSourceFields pageReferrer={false} />
        <UsernameField value={username} onChange={setUsername} serverError={fieldError("username")} autoFocus />

        {needsName && (
          <FormField id="fullName" label="Full name" error={fieldError("fullName")}>
            <IconInput
              icon={User}
              id="fullName"
              name="fullName"
              autoComplete="name"
              placeholder="Maya Patel"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              aria-invalid={fieldError("fullName") ? true : undefined}
              aria-describedby={describedBy("fullName", fieldError("fullName"))}
            />
          </FormField>
        )}

        <PhoneField error={fieldError("phone")} />

        <TermsCheckbox error={fieldError("acceptTerms")} />

        <Button type="submit" size="lg" className="mt-1 w-full" loading={pending}>
          Continue to dashboard
          <ArrowRight aria-hidden="true" className="size-5" />
        </Button>
      </form>

      <p className="text-center text-sm font-medium text-mute">
        Just buying?{" "}
        <Link href="/library" className={linkClass}>
          Go to your library
        </Link>
      </p>
    </>
  );
}
