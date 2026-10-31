"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, describedBy } from "@/components/ui/form-field";
import { IconInput } from "@/components/ui/icon-input";
import { createPasswordFromLink, type PasswordState } from "@/lib/auth/buyer-actions";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/config";

/** Create-a-password form for the order email link (D-037). Typed values stay after an error. */
export function CreatePasswordForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(createPasswordFromLink.bind(null, token), null);
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const error = state && !state.ok ? state : null;
  const fieldError = (field: string) => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;

  useEffect(() => {
    if (error?.field) document.getElementById(error.field)?.focus();
  }, [error]);

  const type = show ? "text" : "password";
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {formError && (
        <Alert variant="error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <FormField id="email" label="Your email">
        <IconInput icon={Lock} id="email" value={email} readOnly tabIndex={-1} autoComplete="username" className="bg-bg-subtle text-mute" />
      </FormField>
      <FormField id="password" label="Create a password" error={fieldError("password")} hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}>
        <div className="relative">
          <IconInput
            icon={Lock}
            id="password"
            name="password"
            type={type}
            autoComplete="new-password"
            required
            maxLength={PASSWORD_MAX_LENGTH}
            value={values.password}
            onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
            aria-invalid={fieldError("password") ? true : undefined}
            aria-describedby={describedBy("password", fieldError("password"), "hint")}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShow((value) => !value)}
            aria-label={show ? "Hide passwords" : "Show passwords"}
            className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-mute hover:text-ink"
          >
            {show ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </FormField>
      <FormField id="confirm" label="Confirm your password" error={fieldError("confirm")}>
        <IconInput
          icon={Lock}
          id="confirm"
          name="confirm"
          type={type}
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          value={values.confirm}
          onChange={(event) => setValues((current) => ({ ...current, confirm: event.target.value }))}
          aria-invalid={fieldError("confirm") ? true : undefined}
          aria-describedby={describedBy("confirm", fieldError("confirm"))}
        />
      </FormField>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create password and open my purchase
      </Button>
    </form>
  );
}
