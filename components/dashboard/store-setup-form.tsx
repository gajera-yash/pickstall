"use client";

import { Check, Eye, Image as ImageIcon, Plus, Store, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { SOCIAL_ICONS } from "@/components/dashboard/social-icons";
import { StorePreview } from "@/components/dashboard/store-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { FormField, describedBy } from "@/components/ui/form-field";
import { IconInput } from "@/components/ui/icon-input";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  SOCIAL_LINK_KINDS,
  SOCIAL_LINK_LABELS,
  SOCIAL_LINKS_MAX,
  type Currency,
  type SocialLinkKind,
} from "@/lib/config";
import { saveStoreSetup, type StoreSetupState } from "@/lib/stores/actions";
import { STORE_BIO_MAX_LENGTH, STORE_NAME_MAX_LENGTH } from "@/lib/stores/schemas";
import type { ThemePresetId } from "@/lib/themes";

type SocialRow = { key: number; kind: SocialLinkKind; url: string };

type Values = {
  name: string;
  bio: string;
  avatarUrl: string;
  currency: Currency;
  socialLinks: { kind: SocialLinkKind; url: string }[];
};

type Props = {
  initial: Values;
  slug: string;
  /** Theme is edited on My Store > Page design; the preview still uses it. */
  theme: { preset: ThemePresetId; accent: string };
};

const toRows = (links: Values["socialLinks"]): SocialRow[] => links.map((link, index) => ({ key: index, ...link }));
const snapshot = (values: Omit<Values, "socialLinks">, rows: SocialRow[]) =>
  JSON.stringify([values, rows.filter((row) => row.url.trim()).map(({ kind, url }) => [kind, url.trim()])]);

/**
 * Store setup (PRD F8, DESIGN.md 10.3 and 9.13): profile cards in one column with a sticky live
 * preview on wide screens (behind a Preview button otherwise), social links list, unsaved-changes
 * guard, and "Saving..." then "Saved" on the button.
 */
export function StoreSetupForm({ initial, slug, theme }: Props) {
  const [state, action, pending] = useActionState<StoreSetupState, FormData>(saveStoreSetup, null);
  const { socialLinks: initialLinks, ...initialFields } = initial;
  const [values, setValues] = useState(initialFields);
  const [rows, setRows] = useState<SocialRow[]>(() => toRows(initialLinks));
  const nextKey = useRef(initialLinks.length);
  const [saved, setSaved] = useState(() => snapshot(initialFields, toRows(initialLinks)));

  const current = snapshot(values, rows);
  const dirty = current !== saved;

  const set = <K extends keyof typeof values>(field: K, value: (typeof values)[K]) => setValues((prev) => ({ ...prev, [field]: value }));
  const setRow = (key: number, change: Partial<SocialRow>) => setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const addRow = () => {
    const used = new Set(rows.map((row) => row.kind));
    const kind = SOCIAL_LINK_KINDS.find((candidate) => !used.has(candidate)) ?? "website";
    const key = nextKey.current++;
    setRows((prev) => [...prev, { key, kind, url: "" }]);
    // Focus the new URL field once it exists.
    requestAnimationFrame(() => document.getElementById(`socialUrl-${rows.length}`)?.focus());
  };
  const removeRow = (key: number) => setRows((prev) => prev.filter((row) => row.key !== key));

  const error = state && !state.ok ? state : null;
  const fieldError = (field: string) => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;
  const justSaved = state?.ok && !dirty;

  // What was sent becomes the saved snapshot when the result comes back ok.
  const [submitted, setSubmitted] = useState(saved);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setSaved(submitted);
  }

  useEffect(() => {
    if (state && !state.ok && state.field) document.getElementById(state.field)?.focus();
  }, [state]);

  // Unsaved-changes guard (DESIGN.md 9.13).
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const previewData = {
    slug,
    name: values.name,
    bio: values.bio,
    avatarUrl: values.avatarUrl,
    socialLinks: rows.filter((row) => row.url.trim()).map(({ kind, url }) => ({ kind, url })),
    themePreset: theme.preset,
    accent: theme.accent,
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <form action={action} onSubmit={() => setSubmitted(current)} noValidate className="flex min-w-0 flex-col gap-6">
        {justSaved && (
          <Alert variant="success">
            <AlertDescription>Your store is saved.</AlertDescription>
          </Alert>
        )}
        {formError && (
          <Alert variant="error">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <h2 className="font-display text-h3">Profile</h2>
            <p className="text-sm text-mute">What buyers see at the top of your store page.</p>
          </CardHeader>

          <FormField id="name" label="Store name" error={fieldError("name")} hint={`${values.name.length}/${STORE_NAME_MAX_LENGTH}`}>
            <IconInput
              icon={Store}
              id="name"
              name="name"
              required
              maxLength={STORE_NAME_MAX_LENGTH}
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              aria-invalid={fieldError("name") ? true : undefined}
              aria-describedby={describedBy("name", fieldError("name"), "hint")}
            />
          </FormField>

          <FormField
            id="avatarUrl"
            label="Photo link (optional)"
            error={fieldError("avatarUrl")}
            hint="Paste an https link to your photo. Uploading a photo is coming next."
          >
            <IconInput
              icon={ImageIcon}
              id="avatarUrl"
              name="avatarUrl"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={values.avatarUrl}
              onChange={(event) => set("avatarUrl", event.target.value)}
              aria-invalid={fieldError("avatarUrl") ? true : undefined}
              aria-describedby={describedBy("avatarUrl", fieldError("avatarUrl"), "hint")}
            />
          </FormField>

          <FormField id="bio" label="Bio (optional)" error={fieldError("bio")} hint={`${values.bio.length}/${STORE_BIO_MAX_LENGTH}`}>
            <Textarea
              id="bio"
              name="bio"
              rows={3}
              maxLength={STORE_BIO_MAX_LENGTH}
              placeholder="I teach busy people to cook in 20 minutes."
              value={values.bio}
              onChange={(event) => set("bio", event.target.value)}
              aria-invalid={fieldError("bio") ? true : undefined}
              aria-describedby={describedBy("bio", fieldError("bio"), "hint")}
            />
          </FormField>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-h3">Social links</h2>
            <p className="text-sm text-mute">
              Shown as icons under your bio. Up to {SOCIAL_LINKS_MAX}, each starting with https://
            </p>
          </CardHeader>

          {rows.length > 0 && (
            <ul className="flex flex-col gap-4">
              {rows.map((row, index) => {
                const Icon = SOCIAL_ICONS[row.kind];
                const urlId = `socialUrl-${index}`;
                const urlError = fieldError(urlId);
                return (
                  <li key={row.key} className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <div className="relative sm:w-44 sm:shrink-0">
                        <Icon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 z-10 size-5 -translate-y-1/2 text-mute" />
                        <Select
                          name="socialKind"
                          aria-label={`Link ${index + 1}: where it goes`}
                          value={row.kind}
                          onChange={(event) => setRow(row.key, { kind: event.target.value as SocialLinkKind })}
                          className="pl-11"
                        >
                          {SOCIAL_LINK_KINDS.map((kind) => (
                            <option key={kind} value={kind}>
                              {SOCIAL_LINK_LABELS[kind]}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex min-w-0 flex-1 gap-2">
                        <Input
                          id={urlId}
                          name="socialUrl"
                          type="url"
                          inputMode="url"
                          placeholder="https://"
                          aria-label={`Link ${index + 1}: ${SOCIAL_LINK_LABELS[row.kind]} address`}
                          value={row.url}
                          onChange={(event) => setRow(row.key, { url: event.target.value })}
                          aria-invalid={urlError ? true : undefined}
                          aria-describedby={urlError ? `${urlId}-error` : undefined}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove link ${index + 1} (${SOCIAL_LINK_LABELS[row.kind]})`}
                          onClick={() => removeRow(row.key)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                    {urlError && <FieldError id={`${urlId}-error`}>{urlError}</FieldError>}
                  </li>
                );
              })}
            </ul>
          )}
          {fieldError("socialLinks") && <FieldError id="socialLinks">{fieldError("socialLinks")}</FieldError>}

          {rows.length < SOCIAL_LINKS_MAX ? (
            <Button type="button" variant="secondary" className="self-start" onClick={addRow}>
              <Plus aria-hidden="true" />
              {rows.length === 0 ? "Add a link" : "Add another link"}
            </Button>
          ) : (
            <p className="text-sm text-mute">You have added the most links a store can show.</p>
          )}
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-h3">Currency</h2>
          </CardHeader>
          <FormField id="currency" label="Store currency" error={fieldError("currency")} hint="Prices on your store use this currency.">
            <Select
              id="currency"
              name="currency"
              value={values.currency}
              onChange={(event) => set("currency", event.target.value as Currency)}
              aria-invalid={fieldError("currency") ? true : undefined}
              aria-describedby={describedBy("currency", fieldError("currency"), "hint")}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {CURRENCY_LABELS[currency]}
                </option>
              ))}
            </Select>
          </FormField>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending} disabled={!dirty && !pending}>
            {pending ? "Saving..." : justSaved ? (
              <>
                <Check aria-hidden="true" />
                Saved
              </>
            ) : (
              "Save changes"
            )}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="secondary" className="xl:hidden">
                <Eye aria-hidden="true" />
                Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-bg-subtle sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Preview</DialogTitle>
              </DialogHeader>
              <StorePreview data={previewData} />
            </DialogContent>
          </Dialog>
          {dirty && !pending && <p className="text-sm text-mute">You have unsaved changes.</p>}
        </div>
      </form>

      <div className="hidden flex-col gap-3 xl:sticky xl:top-20 xl:flex">
        <p className="text-sm font-semibold text-mute">Live preview</p>
        <StorePreview data={previewData} />
      </div>
    </div>
  );
}
