"use client";

import { useActionState, useEffect, useState } from "react";

import { useDesignDraft } from "@/components/dashboard/design-draft";
import { ThemeFields, accentReadable } from "@/components/dashboard/theme-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useAutoHide } from "@/components/ui/use-auto-hide";
import { savePageDesign, type PageDesignState } from "@/lib/stores/actions";
import type { ThemePresetId } from "@/lib/themes";

type Props = {
  initial: { themePreset: ThemePresetId; accent: string };
};

/**
 * Page design tab (PRD F8): theme cards and an accent color with a live contrast check (DESIGN.md
 * 11: never allow low-contrast buttons). The live preview is the Store preview next to it, which
 * shows these choices before they are saved (D-062).
 */
export function PageDesignForm({ initial }: Props) {
  const draft = useDesignDraft();
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

  // A good save makes the edited design the saved one in the preview too.
  useEffect(() => {
    if (state?.ok) draft?.markSaved(submitted);
    // Only a new save result counts; `submitted` is what that save sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const pickTheme = (id: ThemePresetId) => {
    setThemePreset(id);
    draft?.patch({ themePreset: id });
  };
  const pickAccent = (value: string) => {
    setAccent(value);
    draft?.patch({ accent: value });
  };

  const contrastOk = accentReadable(accent);
  const dirty = themePreset !== savedValues.themePreset || accent.toUpperCase() !== savedValues.accent.toUpperCase();

  const error = state && !state.ok ? state : null;
  const fieldError = (field: "themePreset" | "accent") => (error?.field === field ? error.error : null);
  const formError = error && !error.field ? error.error : null;
  const showSaved = useAutoHide(state?.ok ? state : null);

  return (
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
          <ThemeFields themePreset={themePreset} accent={accent} onThemePreset={pickTheme} onAccent={pickAccent} fieldError={fieldError} />
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending} disabled={!contrastOk || !dirty}>
            {pending ? "Saving..." : "Save page design"}
          </Button>
          {dirty && !pending && <p className="text-sm text-mute">You have unsaved changes. The Store preview shows them already.</p>}
        </div>
      </form>
  );
}
