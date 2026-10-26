"use client";

import { AtSign, Phone, User } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, describedBy } from "@/components/ui/form-field";
import { IconInput } from "@/components/ui/icon-input";
import { claimUsername, type ClaimUsernameState } from "@/lib/auth/actions";
import { storeLink } from "@/lib/config";
import { PHONE_HINT } from "@/lib/phone";
import { normalizeSlugInput } from "@/lib/slug";

type FieldName = "username" | "fullName" | "phone";

const linkClass = "text-blue underline underline-offset-4 hover:text-blue-hover";

/**
 * Choose a username (D-020): new Google users, users without a store, or when the signup username
 * was taken. Creates the draft store, then goes to the dashboard.
 */
export function UsernameStep({ needsName, taken }: { needsName: boolean; taken: boolean }) {
  const [state, action, pending] = useActionState<ClaimUsernameState, FormData>(claimUsername, null);
  const [values, setValues] = useState({ username: "", fullName: "", phone: "" });
  const set = (field: FieldName, value: string) => setValues((current) => ({ ...current, [field]: value }));

  const error = state && !state.ok ? state : null;
  const fieldError = (field: FieldName) => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;

  useEffect(() => {
    if (state && !state.ok && state.field) document.getElementById(state.field)?.focus();
  }, [state]);

  const usernameHint = `Your link: ${storeLink(values.username || "yourname")}`;

  return (
    <>
      <p className="-mt-3 text-center text-mute">This becomes your store link. You can change your store name later.</p>

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

      <form action={action} noValidate className="flex flex-col gap-5">
        <FormField id="username" label="Username" error={fieldError("username")} hint={usernameHint}>
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
            autoFocus
            value={values.username}
            onChange={(event) => set("username", normalizeSlugInput(event.target.value))}
            aria-invalid={fieldError("username") ? true : undefined}
            aria-describedby={describedBy("username", fieldError("username"), usernameHint)}
          />
        </FormField>

        {needsName && (
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
        )}

        <FormField id="phone" label="Phone (optional)" error={fieldError("phone")} hint={PHONE_HINT}>
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
            aria-describedby={describedBy("phone", fieldError("phone"), PHONE_HINT)}
          />
        </FormField>

        <Button type="submit" size="lg" className="mt-1 w-full" loading={pending}>
          Create my store
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
