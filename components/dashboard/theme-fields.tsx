"use client";
import { CheckCircle2 } from "lucide-react";

import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayoutThumb } from "@/components/store/layout-thumb";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AA_TEXT } from "@/lib/contrast";
import { THEME_PRESETS, THEME_PRESET_IDS, onAccentFor, type ThemePresetId } from "@/lib/themes";
import { cn } from "@/lib/utils";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** True when the accent is a hex color whose button text passes AA contrast (DESIGN.md 11). */
export function accentReadable(accent: string): boolean {
  return HEX.test(accent) && onAccentFor(accent).ratio >= AA_TEXT;
}

type Props = {
  themePreset: ThemePresetId;
  accent: string;
  onThemePreset: (id: ThemePresetId) => void;
  onAccent: (accent: string) => void;
  fieldError: (field: "themePreset" | "accent") => string | null;
};

/**
 * Theme cards and the accent color with a live contrast check. The inputs are named themePreset and
 * accent, so they submit with whichever form holds them: Page design, or Store setup in the wizard.
 * Picking a theme resets the accent to that theme's own.
 */
export function ThemeFields({ themePreset, accent, onThemePreset, onAccent, fieldError }: Props) {
  const accentValid = HEX.test(accent);
  const contrast = accentValid ? onAccentFor(accent) : null;
  const contrastOk = contrast !== null && contrast.ratio >= AA_TEXT;

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Theme</legend>
        <RadioGroup
          name="themePreset"
          value={themePreset}
          onValueChange={(value) => {
            const id = value as ThemePresetId;
            onThemePreset(id);
            onAccent(THEME_PRESETS[id].accent);
          }}
          aria-invalid={fieldError("themePreset") ? true : undefined}
          aria-describedby={fieldError("themePreset") ? "themePreset-error" : undefined}
          className="grid-cols-1 sm:grid-cols-3"
        >
          {THEME_PRESET_IDS.map((id) => {
            const preset = THEME_PRESETS[id];
            return (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface p-3 transition-colors duration-(--dur-fast) hover:border-field-border hover:bg-bg-subtle",
                  "has-data-[state=checked]:border-blue has-data-[state=checked]:bg-blue-soft",
                )}
              >
                {/* The theme's layout, sketched in its own colors (theme data, lib/themes.ts). */}
                <LayoutThumb preset={preset} />
                <span className="flex-1 font-semibold">{preset.name}</span>
                <RadioGroupItem id={id === THEME_PRESET_IDS[0] ? "themePreset" : undefined} value={id} aria-label={preset.name} />
              </label>
            );
          })}
        </RadioGroup>
        {fieldError("themePreset") && <FieldError id="themePreset-error">{fieldError("themePreset")}</FieldError>}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="accent">Accent color</Label>
        <p className="-mt-1 text-sm text-mute">Used for your buttons. We check that the button text stays easy to read.</p>
        <div className="flex items-center gap-3">
          <Input
            type="color"
            aria-label="Pick accent color"
            value={(accentValid ? accent : THEME_PRESETS[themePreset].accent).toLowerCase()}
            onChange={(event) => onAccent(event.target.value.toUpperCase())}
            className="w-14 shrink-0 cursor-pointer p-1"
          />
          <Input
            id="accent"
            name="accent"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={7}
            className="font-mono uppercase"
            value={accent}
            onChange={(event) => onAccent(event.target.value.trim())}
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
    </div>
  );
}
