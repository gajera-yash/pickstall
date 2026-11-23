"use client";

import { useState } from "react";

import { useDesignDraft, useSaver } from "@/components/dashboard/design-draft";
import { ThemeFields, accentReadable } from "@/components/dashboard/theme-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { savePageDesign } from "@/lib/stores/actions";
import type { ThemePresetId } from "@/lib/themes";

type Props = {
  initial: { themePreset: ThemePresetId; accent: string };
};

/**
 * The Theme tab of Store design (PRD F8, D-125): theme cards and an accent color with a live
 * contrast check (DESIGN.md 11: never allow low-contrast buttons). The preview next to it shows
 * every pick before it is saved; the page's one Save button saves it.
 */
export function PageDesignForm({ initial }: Props) {
  const draft = useDesignDraft();
  const [themePreset, setThemePreset] = useState<ThemePresetId>(initial.themePreset);
  const [accent, setAccent] = useState(initial.accent);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);

  const dirty = themePreset !== saved.themePreset || accent.toUpperCase() !== saved.accent.toUpperCase();

  useSaver("theme", dirty, async () => {
    if (!accentReadable(accent)) {
      setError({ field: "accent", text: "This color is too light or too dark for button text. Pick a stronger color." });
      return false;
    }
    const form = new FormData();
    form.set("themePreset", themePreset);
    form.set("accent", accent.toUpperCase());
    const result = await savePageDesign(null, form);
    if (!result?.ok) {
      setError({ field: result?.field, text: result?.error ?? "Couldn't save. Try again." });
      if (result?.field) document.getElementById(result.field)?.focus();
      return false;
    }
    setError(null);
    const next = { themePreset, accent: accent.toUpperCase() };
    setSaved(next);
    draft?.markSaved(next);
    return true;
  });

  const pickTheme = (id: ThemePresetId) => {
    setThemePreset(id);
    draft?.patch({ themePreset: id });
  };
  const pickAccent = (value: string) => {
    setAccent(value);
    draft?.patch({ accent: value });
  };

  const fieldError = (field: "themePreset" | "accent") => (error?.field === field ? error.text : null);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {error && !error.field && (
        <Alert variant="error">
          <AlertDescription>{error.text}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3">Theme and color</h2>
        <p className="text-sm text-mute">Start with a theme, then pick your accent color for buttons. Make it your own in Customize.</p>
      </div>
      <ThemeFields themePreset={themePreset} accent={accent} onThemePreset={pickTheme} onAccent={pickAccent} fieldError={fieldError} />
    </div>
  );
}
