"use client";

import { useActionState, useEffect, useState } from "react";

import { StorePreview, type PreviewProduct, type StorePreviewData } from "@/components/dashboard/store-preview";
import { ThemeFields, accentReadable } from "@/components/dashboard/theme-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useAutoHide } from "@/components/ui/use-auto-hide";
import { savePageDesign, type PageDesignState } from "@/lib/stores/actions";
import type { ThemePresetId } from "@/lib/themes";

type Props = {
  initial: { themePreset: ThemePresetId; accent: string };
  /** The rest of the store, for the live preview. */
  preview: Omit<StorePreviewData, "themePreset" | "accent">;
  products?: PreviewProduct[];
  currency?: string;
};

/**
 * Page design tab (PRD F8: theme and accent in Phase 1). Theme cards, an accent color with a live
 * contrast check (DESIGN.md 11: never allow low-contrast buttons), and a live phone preview.
 */
export function PageDesignForm({ initial, preview, products, currency }: Props) {
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

  const contrastOk = accentReadable(accent);
  const dirty = themePreset !== savedValues.themePreset || accent.toUpperCase() !== savedValues.accent.toUpperCase();

  const error = state && !state.ok ? state : null;
  const fieldError = (field: "themePreset" | "accent") => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;
  const showSaved = useAutoHide(state?.ok ? state : null);

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
            <h3 className="font-display text-h3">Theme and color</h3>
            <p className="text-sm text-mute">Colors, corners and borders for your store page.</p>
          </CardHeader>
          <ThemeFields themePreset={themePreset} accent={accent} onThemePreset={setThemePreset} onAccent={setAccent} fieldError={fieldError} />
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
        <StorePreview data={{ ...preview, themePreset, accent }} products={products} currency={currency} />
      </div>
    </div>
  );
}
