"use client";

import { CheckCircle2, Image as ImageIcon, Link2, Store } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { FormField, describedBy } from "@/components/ui/form-field";
import { IconInput } from "@/components/ui/icon-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES, CURRENCY_LABELS, type Currency } from "@/lib/config";
import { AA_TEXT } from "@/lib/contrast";
import { saveStoreSetup, type StoreSetupState } from "@/lib/stores/actions";
import { STORE_BIO_MAX_LENGTH, STORE_NAME_MAX_LENGTH } from "@/lib/stores/schemas";
import { THEME_PRESETS, THEME_PRESET_IDS, onAccentFor, type ThemePresetId } from "@/lib/themes";
import { cn } from "@/lib/utils";

type Values = {
  name: string;
  bio: string;
  avatarUrl: string;
  link: string;
  currency: Currency;
  themePreset: ThemePresetId;
  accent: string;
};

type FieldName = keyof Values;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Store setup form (DESIGN.md 9.13: single column; counters on length-limited text; contrast check on the accent). */
export function StoreSetupForm({ initial }: { initial: Values }) {
  const [state, action, pending] = useActionState<StoreSetupState, FormData>(saveStoreSetup, null);
  const [values, setValues] = useState<Values>(initial);
  const set = <K extends FieldName>(field: K, value: Values[K]) => setValues((current) => ({ ...current, [field]: value }));

  const error = state && !state.ok ? state : null;
  const fieldError = (field: FieldName) => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;

  useEffect(() => {
    if (state && !state.ok && state.field) document.getElementById(state.field)?.focus();
  }, [state]);

  const accentValid = HEX.test(values.accent);
  const contrast = accentValid ? onAccentFor(values.accent) : null;
  const contrastOk = contrast !== null && contrast.ratio >= AA_TEXT;

  const pickPreset = (id: ThemePresetId) => setValues((current) => ({ ...current, themePreset: id, accent: THEME_PRESETS[id].accent }));

  return (
    <form action={action} noValidate className="flex max-w-xl flex-col gap-6">
      {state?.ok && (
        <Alert variant="success">
          <AlertDescription>Your store is saved.</AlertDescription>
        </Alert>
      )}
      {formError && (
        <Alert variant="error">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

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

      <FormField id="link" label="Your link (optional)" error={fieldError("link")} hint="Your website, YouTube or Instagram. Must start with https://">
        <IconInput
          icon={Link2}
          id="link"
          name="link"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={values.link}
          onChange={(event) => set("link", event.target.value)}
          aria-invalid={fieldError("link") ? true : undefined}
          aria-describedby={describedBy("link", fieldError("link"), "hint")}
        />
      </FormField>

      <FormField id="currency" label="Currency" error={fieldError("currency")} hint="Prices on your store use this currency.">
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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Theme</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {THEME_PRESET_IDS.map((id) => {
            const preset = THEME_PRESETS[id];
            const selected = values.themePreset === id;
            return (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors duration-(--dur-fast)",
                  "has-focus-visible:ring-2 has-focus-visible:ring-ring",
                  selected ? "border-blue bg-blue-soft" : "border-border-ui hover:border-ink",
                )}
              >
                <input
                  type="radio"
                  name="themePreset"
                  value={id}
                  checked={selected}
                  onChange={() => pickPreset(id)}
                  className="sr-only"
                />
                {/* Preview swatch: the preset's own colors (theme data, lib/themes.ts). */}
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-line text-xs font-bold"
                  style={{ background: preset.background, color: preset.text }}
                >
                  Aa
                </span>
                <span className="flex flex-1 items-center justify-between gap-2 font-semibold">
                  {preset.name}
                  {selected && <CheckCircle2 aria-hidden="true" className="size-5 text-blue" />}
                </span>
              </label>
            );
          })}
        </div>
        {fieldError("themePreset") && <FieldError id="themePreset-error">{fieldError("themePreset")}</FieldError>}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="accent">Accent color</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Pick accent color"
            value={(accentValid ? values.accent : THEME_PRESETS[values.themePreset].accent).toLowerCase()}
            onChange={(event) => set("accent", event.target.value.toUpperCase())}
            className="h-12 w-14 shrink-0 cursor-pointer rounded-sm border border-input bg-surface p-1"
          />
          <Input
            id="accent"
            name="accent"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={7}
            className="font-mono uppercase"
            value={values.accent}
            onChange={(event) => set("accent", event.target.value.trim())}
            aria-invalid={fieldError("accent") || (accentValid && !contrastOk) ? true : undefined}
            aria-describedby={fieldError("accent") ? "accent-error" : "accent-check"}
          />
        </div>
        {fieldError("accent") ? (
          <FieldError id="accent-error">{fieldError("accent")}</FieldError>
        ) : contrast && contrastOk ? (
          <FieldHint id="accent-check" className="flex items-center gap-2">
            {/* Live button preview with the computed on-accent color. */}
            <span
              aria-hidden="true"
              className="rounded-sm px-3 py-1 text-sm font-semibold"
              style={{ background: values.accent, color: contrast.color }}
            >
              Buy now
            </span>
            Contrast {contrast.ratio.toFixed(1)}:1, easy to read.
          </FieldHint>
        ) : (
          <FieldError id="accent-check">
            {accentValid
              ? `Contrast ${contrast?.ratio.toFixed(1)}:1 is too low for button text. Pick a stronger color.`
              : `Enter a color like ${THEME_PRESETS.clean.accent}.`}
          </FieldError>
        )}
      </div>

      <Button type="submit" size="lg" className="self-start" loading={pending} disabled={!contrastOk}>
        Save store
      </Button>
    </form>
  );
}
