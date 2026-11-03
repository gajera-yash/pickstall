"use client";

import { ArrowRight, Check, CheckCircle2, Circle, Eye, Plus, Store, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { SOCIAL_ICONS } from "@/components/dashboard/social-icons";
import { StorePreview, type PreviewProduct } from "@/components/dashboard/store-preview";
import { ThemeFields, accentReadable } from "@/components/dashboard/theme-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { FormField, describedBy } from "@/components/ui/form-field";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import { IconInput } from "@/components/ui/icon-input";
import { useAutoHide } from "@/components/ui/use-auto-hide";
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
import { THEME_PRESETS, type ThemePresetId } from "@/lib/themes";
import { cn } from "@/lib/utils";

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
  /** Edited here only in the setup wizard; in Settings it lives on My Store > Page design. */
  theme: { preset: ThemePresetId; accent: string };
  /**
   * "setup": step 1 of the setup wizard (D-045). Adds the theme fields and a done/to-do summary,
   * and "Save and continue" goes to `continueHref` after a successful save.
   */
  mode?: "settings" | "setup";
  continueHref?: string;
  products?: PreviewProduct[];
};

const toRows = (links: Values["socialLinks"]): SocialRow[] => links.map((link, index) => ({ key: index, ...link }));
const snapshot = (values: Omit<Values, "socialLinks">, rows: SocialRow[], design: { preset: ThemePresetId; accent: string }) =>
  JSON.stringify([values, rows.filter((row) => row.url.trim()).map(({ kind, url }) => [kind, url.trim()]), design.preset, design.accent.toUpperCase()]);

/**
 * Store setup (PRD F8, DESIGN.md 10.3 and 9.13): profile cards in one column with a sticky live
 * preview on wide screens (behind a Preview button otherwise), social links list, unsaved-changes
 * guard, and "Saving..." then "Saved" on the button.
 */
export function StoreSetupForm({ initial, slug, theme, mode = "settings", continueHref, products }: Props) {
  const router = useRouter();
  const setup = mode === "setup";
  const [state, action, pending] = useActionState<StoreSetupState, FormData>(saveStoreSetup, null);
  const { socialLinks: initialLinks, ...initialFields } = initial;
  const [values, setValues] = useState(initialFields);
  const [rows, setRows] = useState<SocialRow[]>(() => toRows(initialLinks));
  const [design, setDesign] = useState(theme);
  const nextKey = useRef(initialLinks.length);
  const [saved, setSaved] = useState(() => snapshot(initialFields, toRows(initialLinks), theme));

  const current = snapshot(values, rows, design);
  const dirty = current !== saved;
  // Step 1 counts as done with a photo or a bio (lib/dashboard/checklist.ts), so the wizard asks for one.
  const personalized = Boolean(values.avatarUrl.trim() || values.bio.trim());
  const linkCount = rows.filter((row) => row.url.trim()).length;

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
  const designError = (field: "themePreset" | "accent") => fieldError(field);
  const formError = error && !error.field ? error.error : null;
  const justSaved = useAutoHide(state?.ok ? state : null) && !dirty;

  // What was sent becomes the saved snapshot when the result comes back ok.
  const [submitted, setSubmitted] = useState(saved);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setSaved(submitted);
  }

  // In the wizard a successful save moves straight on to the next step.
  useEffect(() => {
    if (setup && state?.ok && continueHref) {
      router.push(continueHref);
      router.refresh();
    }
  }, [setup, state, continueHref, router]);

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
    themePreset: design.preset,
    accent: design.accent,
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

        {setup && (
          <SetupSummary
            items={[
              { label: "Store name", done: Boolean(values.name.trim()), detail: values.name.trim() || "Missing" },
              { label: "Profile photo", done: Boolean(values.avatarUrl.trim()), detail: values.avatarUrl.trim() ? "Added" : "Optional" },
              { label: "Bio", done: Boolean(values.bio.trim()), detail: values.bio.trim() ? "Added" : "Optional" },
              { label: "Theme", done: true, detail: THEME_PRESETS[design.preset].name },
              { label: "Social links", done: linkCount > 0, detail: linkCount > 0 ? `${linkCount} added` : "Optional" },
            ]}
            hint={personalized ? null : "Add a profile photo or a short bio to finish this step."}
          />
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

          <input type="hidden" name="avatarUrl" value={values.avatarUrl} />
          <ImageUploader
            id="avatarUrl"
            label="Profile photo (optional)"
            kind="avatar"
            value={values.avatarUrl}
            onChange={(value) => set("avatarUrl", value)}
            error={fieldError("avatarUrl")}
          />

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

        {setup && (
          <Card>
            <CardHeader>
              <h2 className="font-display text-h3">Theme and color</h2>
              <p className="text-sm text-mute">Pick a look for your store page. You can change it any time.</p>
            </CardHeader>
            <ThemeFields
              themePreset={design.preset}
              accent={design.accent}
              onThemePreset={(preset) => setDesign((prev) => ({ ...prev, preset }))}
              onAccent={(accent) => setDesign((prev) => ({ ...prev, accent }))}
              fieldError={designError}
            />
          </Card>
        )}

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
          {setup ? (
            <Button type="submit" loading={pending} disabled={!personalized || !accentReadable(design.accent)}>
              {pending ? "Saving..." : "Save and continue"}
              {!pending && <ArrowRight aria-hidden="true" />}
            </Button>
          ) : (
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
          )}
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
              <StorePreview data={previewData} products={products} currency={values.currency} />
            </DialogContent>
          </Dialog>
          {dirty && !pending && <p className="text-sm text-mute">You have unsaved changes.</p>}
        </div>
      </form>

      <div className="hidden flex-col gap-3 xl:sticky xl:top-20 xl:flex">
        <p className="text-sm font-semibold text-mute">Live preview</p>
        <StorePreview data={previewData} products={products} currency={values.currency} />
      </div>
    </div>
  );
}

/** What step 1 of the wizard has and still needs, updated as the creator types. */
function SetupSummary({ items, hint }: { items: { label: string; done: boolean; detail: string }[]; hint: string | null }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <h2 className="font-display text-h3">Your store so far</h2>
        <p className="text-sm text-mute">This list updates as you fill in the form.</p>
      </CardHeader>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.label} className={cn("flex items-center gap-3 rounded-md border px-3 py-2.5", item.done ? "border-mint/30 bg-mint-soft" : "border-line")}>
            {item.done ? (
              <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 fill-mint text-surface" />
            ) : (
              <Circle aria-hidden="true" className="size-5 shrink-0 text-mute" />
            )}
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">
                {item.label}
                <span className="sr-only">{item.done ? " (done)" : " (not done)"}</span>
              </span>
              <span className="truncate text-xs text-mute">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {hint && <p className="text-sm font-medium text-warning">{hint}</p>}
    </Card>
  );
}
