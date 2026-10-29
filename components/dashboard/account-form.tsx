"use client";

import { Mail, UserRound } from "lucide-react";
import { useActionState, useEffect } from "react";

import { PhoneField } from "@/components/auth/phone-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FormField, describedBy } from "@/components/ui/form-field";
import { IconInput } from "@/components/ui/icon-input";
import { saveAccount, type AccountState } from "@/lib/account/actions";

/** Account details (PRD F8): name and phone can change; the email is the sign-in identity. */
export function AccountForm({ email, initial }: { email: string; initial: { fullName: string; phone: string | null } }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(saveAccount, null);

  const error = state && !state.ok ? state : null;
  const fieldError = (field: string) => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;

  useEffect(() => {
    if (state && !state.ok && state.field) document.getElementById(state.field)?.focus();
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-h3">Account</h2>
        <p className="text-sm text-mute">Your own details. Buyers do not see these.</p>
      </CardHeader>
      <form action={action} noValidate className="flex flex-col gap-5">
        {state?.ok && (
          <Alert variant="success">
            <AlertDescription>Your account is saved.</AlertDescription>
          </Alert>
        )}
        {formError && (
          <Alert variant="error">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <FormField id="fullName" label="Full name" error={fieldError("fullName")}>
          <IconInput
            icon={UserRound}
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            maxLength={80}
            defaultValue={initial.fullName}
            aria-invalid={fieldError("fullName") ? true : undefined}
            aria-describedby={describedBy("fullName", fieldError("fullName"))}
          />
        </FormField>

        <FormField id="email" label="Email" hint="You sign in with this email. It cannot be changed here yet.">
          <IconInput icon={Mail} id="email" type="email" value={email} readOnly aria-describedby="email-hint" className="bg-bg-subtle text-mute" />
        </FormField>

        <PhoneField error={fieldError("phone")} defaultValue={initial.phone} />

        <Button type="submit" className="self-start" loading={pending}>
          {pending ? "Saving..." : "Save account"}
        </Button>
      </form>
    </Card>
  );
}
