"use client";

import { AtSign, Store } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, describedBy } from "@/components/ui/form-field";
import { IconInput } from "@/components/ui/icon-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES, CURRENCY_LABELS, ROOT_DOMAIN, type Currency } from "@/lib/config";
import { normalizeSlugInput } from "@/lib/slug";
import { createStore, type CreateStoreState } from "@/lib/stores/actions";
import { STORE_BIO_MAX_LENGTH, STORE_NAME_MAX_LENGTH } from "@/lib/stores/schemas";

type FieldName = "name" | "username" | "currency" | "bio";

type Props = {
  /** Suggestions from the signup step. Untrusted: the server validates everything again. */
  defaults: { name: string; username: string | null };
};

const BIO_HINT = `Optional. A short line about you, up to ${STORE_BIO_MAX_LENGTH} characters.`;
const CURRENCY_HINT = "Prices in your store use this currency.";

/** Store basics: name, link, currency and an optional bio. Creates the store (step 3 of the wizard). */
export function StoreBasicsForm({ defaults }: Props) {
  const [state, action, pending] = useActionState<CreateStoreState, FormData>(createStore, null);

  const [name, setName] = useState(defaults.name);
  const [username, setUsername] = useState(defaults.username ?? "");
  const [currency, setCurrency] = useState<Currency>("usd");
  const [bio, setBio] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);

  const error = state && !state.ok ? state : null;
  const fieldError = (field: FieldName) => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;

  // The link is shown as plain text when signup already chose one; it opens for editing on request,
  // or when it is missing or was taken in the meantime.
  const showUsernameField = !defaults.username || editingUsername || error?.field === "username";

  useEffect(() => {
    if (state && !state.ok && state.field) document.getElementById(state.field)?.focus();
  }, [state]);

  const usernameHint = `Your link: ${username || "yourname"}.${ROOT_DOMAIN}`;

  return (
    <>
      {formError && (
        <Alert variant="error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <form action={action} noValidate className="flex flex-col gap-5">
        <FormField id="name" label="Store name" error={fieldError("name")}>
          <IconInput
            icon={Store}
            id="name"
            name="name"
            autoComplete="organization"
            placeholder="Maya's Budget Studio"
            maxLength={STORE_NAME_MAX_LENGTH}
            required
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={fieldError("name") ? true : undefined}
            aria-describedby={describedBy("name", fieldError("name"))}
          />
        </FormField>

        {showUsernameField ? (
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
              value={username}
              onChange={(event) => setUsername(normalizeSlugInput(event.target.value))}
              aria-invalid={fieldError("username") ? true : undefined}
              aria-describedby={describedBy("username", fieldError("username"), usernameHint)}
            />
          </FormField>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-md bg-blue-soft px-4 py-3">
            <input type="hidden" name="username" value={username} />
            <p className="min-w-0 text-sm break-all text-ink">
              Your link: <strong className="font-semibold">{usernameHint.replace("Your link: ", "")}</strong>
            </p>
            <Button type="button" variant="link" size="sm" className="shrink-0" onClick={() => setEditingUsername(true)}>
              Change
            </Button>
          </div>
        )}

        <FormField id="currency" label="Currency" error={fieldError("currency")} hint={CURRENCY_HINT}>
          <Select
            id="currency"
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value as Currency)}
            aria-invalid={fieldError("currency") ? true : undefined}
            aria-describedby={describedBy("currency", fieldError("currency"), CURRENCY_HINT)}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {CURRENCY_LABELS[code]}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField id="bio" label="Short bio (optional)" error={fieldError("bio")} hint={BIO_HINT}>
          <Textarea
            id="bio"
            name="bio"
            rows={3}
            maxLength={STORE_BIO_MAX_LENGTH}
            placeholder="I help creators plan their money."
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            aria-invalid={fieldError("bio") ? true : undefined}
            aria-describedby={describedBy("bio", fieldError("bio"), BIO_HINT)}
          />
        </FormField>

        <Button type="submit" size="lg" className="mt-1 w-full" loading={pending}>
          Create my store
        </Button>
      </form>
    </>
  );
}
