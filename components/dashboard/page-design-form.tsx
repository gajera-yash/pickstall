"use client";

import { CheckCircle2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { StorePreview, type StorePreviewData } from "@/components/dashboard/store-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoHide } from "@/components/ui/use-auto-hide";
import { AA_TEXT } from "@/lib/contrast";
import { savePageDesign, type PageDesignState } from "@/lib/stores/actions";
import { THEME_PRESETS, THEME_PRESET_IDS, onAccentFor, type ThemePresetId } from "@/lib/themes";
import { cn } from "@/lib/utils";

const HEX = /^#[0-9a-fA-F]{6}$/;

type Props = {
  initial: { themePreset: ThemePresetId; accent: string };
  /** The rest of the store, for the live preview. */
  preview: Omit<StorePreviewData, "themePreset" | "accent">;
};

/**
 * Page design tab (PRD F8: theme and accent in Phase 1). Theme cards, an accent color with a live
 * contrast check (DESIGN.md 11: never allow low-contrast buttons), and a live phone preview.
 */
export function PageDesignForm({ initial, preview }: Props) {
  const [state, action, pending] = useActionState<PageDesignState, FormData>(savePageDesign, null);
  const [themePreset, setThemePreset] = useState<ThemePresetId>(initial.themePreset);
  const [accent, setAccent] = useState(initial.accent);
  const [savedValues, setSavedValues] = useState(initial);
  // The values that were sent; they become the saved values when the result comes back ok.
  const [submitted, setSubmitted] = useState(initial);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setSavedValues(submitted);
  }

  useEffect(() => {
    if (state && !state.ok && state.field) document.getElementById(state.field)?.focus();
  }, [state]);

  const accentValid = HEX.test(accent);
  const contrast = accentValid ? onAccentFor(accent) : null;
  const contrastOk = contrast !== null && contrast.ratio >= AA_TEXT;
  const dirty = themePreset !== savedValues.themePreset || accent.toUpperCase() !== savedValues.accent.toUpperCase();

  const error = state && !state.ok ? state : null;
  const fieldError = (field: "themePreset" | "accent") => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;
  const showSaved = useAutoHide(state?.ok ? state : null);

  const pickPreset = (id: ThemePresetId) => {
    setThemePreset(id);
    setAccent(THEME_PRESETS[id].accent);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <form
        action={action}
        onSubmit={() => setSubmitted({ themePreset, accent: accent.toUpperCase() })}
        noValidate
        className="flex min-w-0 flex-col gap-5"
      >
        {showSaved && !dirty && (
          <Alert variant="success">
            <AlertDescription>Page design saved.</AlertDescription>
          </Alert>
        )}
        {formError && (
          <Alert variant="error">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <h3 className="font-display text-h3">Theme</h3>
            <p className="text-sm text-mute">Colors, corners and borders for your store page.</p>
          </CardHeader>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Theme</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {THEME_PRESET_IDS.map((id) => {
                const preset = THEME_PRESETS[id];
                const selected = themePreset === id;
                return (
                  <label
                    key={id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors duration-(--dur-fast)",
                      "has-focus-visible:ring-2 has-focus-visible:ring-ring",
                      selected ? "border-blue bg-blue-soft" : "border-input hover:bg-bg-subtle",
                    )}
                  >
                    <input
                      id={id === THEME_PRESET_IDS[0] ? "themePreset" : undefined}
                      type="radio"
                      name="themePreset"
                      value={id}
                      checked={selected}
                      onChange={() => pickPreset(id)}
                      className="sr-only"
                    />
                    {/* Swatch in the preset's own colors (theme data, lib/themes.ts). */}
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
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-display text-h3">Accent color</h3>
            <p className="text-sm text-mute">Used for your buttons. We check that the button text stays easy to read.</p>
          </CardHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="accent">Hex color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Pick accent color"
                value={(accentValid ? accent : THEME_PRESETS[themePreset].accent).toLowerCase()}
                onChange={(event) => setAccent(event.target.value.toUpperCase())}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-md border border-input bg-surface p-1"
              />
              <Input
                id="accent"
                name="accent"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={7}
                className="font-mono uppercase"
                value={accent}
                onChange={(event) => setAccent(event.target.value.trim())}
                aria-invalid={fieldError("accent") || (accentValid && !contrastOk) ? true : undefined}
                aria-describedby={fieldError("accent") ? "accent-error" : "accent-check"}
              />
            </div>
            {fieldError("accent") ? (
              <FieldError id="accent-error">{fieldError("accent")}</FieldError>
            ) : contrast && contrastOk ? (
              <FieldHint id="accent-check" className="flex items-center gap-2">
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-mint" />
                Good contrast ({contrast.ratio.toFixed(1)}:1).
              </FieldHint>
            ) : (
              <FieldError id="accent-check">
                {accentValid
                  ? `Contrast ${contrast?.ratio.toFixed(1)}:1 is too low for button text. Pick a stronger color.`
                  : `Enter a color like ${THEME_PRESETS.clean.accent}.`}
              </FieldError>
            )}
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending} disabled={!contrastOk || !dirty}>
            {pending ? "Saving..." : "Save page design"}
          </Button>
          {dirty && !pending && <p className="text-sm text-mute">You have unsaved changes.</p>}
        </div>
      </form>

      <div className="flex flex-col gap-3 lg:sticky lg:top-20">
        <p className="text-sm font-semibold text-mute">Live preview</p>
        <StorePreview data={{ ...preview, themePreset, accent }} />
      </div>
    </div>
  );
}
