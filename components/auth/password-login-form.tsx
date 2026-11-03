"use client";

import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { IconInput } from "@/components/ui/icon-input";
import { signInWithPassword, type PasswordLoginState } from "@/lib/auth/actions";
import { PASSWORD_MAX_LENGTH } from "@/lib/config";

/** Email and password sign-in (D-037). Typed values stay after an error. */
export function PasswordLoginForm({ next, onUseCode }: { next: string; onUseCode: () => void }) {
  const [state, action, pending] = useActionState<PasswordLoginState, FormData>(signInWithPassword, null);
  const [values, setValues] = useState({ email: "", password: "" });
  const [show, setShow] = useState(false);
  const error = state && !state.ok ? state : null;
  const fieldError = (field: string) => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      {formError && (
        <Alert variant="error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <FormField id="email" label="Email" error={fieldError("email")}>
        <IconInput
          icon={Mail}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="maya@example.com"
          required
          value={values.email}
          onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
          aria-invalid={fieldError("email") ? true : undefined}
        />
      </FormField>
      <FormField id="password" label="Password" error={fieldError("password")}>
        <IconInput
          icon={Lock}
          id="password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          value={values.password}
          onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
          aria-invalid={fieldError("password") ? true : undefined}
          end={
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setShow((value) => !value)} aria-label={show ? "Hide password" : "Show password"} className="text-mute">
              {show ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
            </Button>
          }
        />
      </FormField>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
      <p className="text-center text-sm text-mute">
        Forgot your password?{" "}
        <button type="button" onClick={onUseCode} className="cursor-pointer font-semibold text-blue underline underline-offset-4 hover:text-blue-hover">
          Get an email code instead
        </button>
      </p>
    </form>
  );
}
