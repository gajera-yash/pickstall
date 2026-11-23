"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { useDesignDraft } from "@/components/dashboard/design-draft";
import { Field } from "@/components/dashboard/editor-fields";
import { ImageUploader } from "@/components/dashboard/image-uploader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveStoreDesignAction } from "@/lib/store-design/actions";
import {
  HEADING_FONTS,
  HEADING_FONT_LABELS,
  LAYOUT_CHOICES,
  LAYOUT_LABELS,
  RADIUS_MAX,
  designContrastProblem,
  designToForm,
  storeDesignInput,
  type StoreDesign,
  type StoreDesignForm,
} from "@/lib/store-design/rules";
import { THEME_PRESETS } from "@/lib/themes";

const HEX = /^#[0-9a-fA-F]{6}$/;
const opts = <T extends string>(entries: [T, string][]) => entries.map(([value, label]) => ({ value, label }));

/** A color with a picker and a hex box. Empty means "use the theme's color". */
function ColorInput({ id, label, value, fallback, onChange }: { id: string; label: string; value: string; fallback: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="color" aria-label={`Pick ${label.toLowerCase()}`} value={(HEX.test(value) ? value : fallback).toLowerCase()} onChange={(event) => onChange(event.target.value.toUpperCase())} className="w-12 shrink-0 cursor-pointer p-1" />
        <Input id={id} value={value} placeholder={`Theme (${fallback})`} maxLength={7} spellCheck={false} autoCapitalize="none" onChange={(event) => onChange(event.target.value.trim())} />
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} aria-label={`Use the theme's ${label.toLowerCase()}`}>
            Theme
          </Button>
        )}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="pb-1 font-display text-h4">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Customize (D-123): the creator's own design on top of the theme. Colors, background, headline
 * font, buttons, cards, layout and header. Every change shows in the Store preview at once; text
 * that would be hard to read is flagged here and refused on save.
 */
export function DesignCustomizer({ initial }: { initial: StoreDesign | null }) {
  const router = useRouter();
  const draft = useDesignDraft();
  const [form, setForm] = useState<StoreDesignForm>(() => designToForm(initial));
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [saving, startSave] = useTransition();

  const presetId = draft?.design.themePreset ?? "clean";
  const accent = draft?.design.accent ?? THEME_PRESETS[presetId].accent;
  const preset = THEME_PRESETS[presetId] ?? THEME_PRESETS.clean;
  const parsed = storeDesignInput.safeParse(form);
  const problem = parsed.success ? designContrastProblem(preset, accent, parsed.data) : { field: "", message: parsed.error.issues[0]?.message ?? "Check your design." };

  const update = (change: (current: StoreDesignForm) => StoreDesignForm) => {
    setMessage(null);
    const next = change(form);
    setForm(next);
    const result = storeDesignInput.safeParse(next);
    // The preview follows every valid step; a half-typed color keeps the last good one.
    if (result.success) draft?.patch({ custom: result.data });
  };

  const save = (design: StoreDesign | null) =>
    startSave(async () => {
      const result = await saveStoreDesignAction(design);
      if (result.ok) {
        draft?.markSaved({ custom: design });
        setMessage({ kind: "success", text: design ? "Design saved. Your store page shows it now." : "Back to the theme's design." });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: result.error });
      }
    });

  const reset = () => {
    const empty = designToForm(null);
    setForm(empty);
    draft?.patch({ custom: null });
    save(null);
  };

  const colors = form.colors;
  const setColor = (key: keyof StoreDesignForm["colors"]) => (value: string) => update((current) => ({ ...current, colors: { ...current.colors, [key]: value } }));

  return (
    <Card>
      <CardHeader>
        <h3 className="font-display text-h3">Customize</h3>
        <p className="text-sm text-mute">Make the theme your own. Anything you leave on &quot;Theme&quot; keeps the theme&apos;s look. The preview shows every change before you save.</p>
      </CardHeader>

      <div className="flex flex-col gap-5">
        <Group title="Colors">
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorInput id="design-background" label="Background" value={colors.background} fallback={preset.background} onChange={setColor("background")} />
            <ColorInput id="design-text" label="Text" value={colors.text} fallback={preset.text} onChange={setColor("text")} />
            <ColorInput id="design-muted" label="Secondary text" value={colors.muted} fallback={preset.muted} onChange={setColor("muted")} />
            <ColorInput id="design-card" label="Cards" value={colors.card} fallback={preset.card} onChange={setColor("card")} />
          </div>
        </Group>

        <Group title="Page background">
          <Field id="design-bg-kind" label="Style">
            <ChoiceSelect
              id="design-bg-kind"
              value={form.background.kind}
              onValueChange={(kind) => update((current) => ({ ...current, background: { ...current.background, kind: kind as StoreDesignForm["background"]["kind"] } }))}
              options={opts([["theme", "Theme background"], ["solid", "One color"], ["gradient", "Gradient"], ["image", "Image"]])}
            />
          </Field>
          {form.background.kind === "gradient" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorInput id="design-grad-from" label="Gradient start" value={form.background.gradient[0]} fallback={preset.background} onChange={(value) => update((current) => ({ ...current, background: { ...current.background, gradient: [value, current.background.gradient[1]] } }))} />
              <ColorInput id="design-grad-to" label="Gradient end" value={form.background.gradient[1]} fallback={preset.card} onChange={(value) => update((current) => ({ ...current, background: { ...current.background, gradient: [current.background.gradient[0], value] } }))} />
            </div>
          )}
          {form.background.kind === "image" && (
            <ImageUploader
              id="design-bg-image"
              label="Background image"
              kind="cover"
              shape="wide"
              value={form.background.image ?? ""}
              onChange={(image) => update((current) => ({ ...current, background: { ...current.background, image } }))}
              hint="It is softly covered with your background color, so text stays easy to read."
            />
          )}
        </Group>

        <Group title="Text">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="design-font" label="Headline font">
              <ChoiceSelect id="design-font" value={form.font} onValueChange={(font) => update((current) => ({ ...current, font: font as StoreDesignForm["font"] }))} options={HEADING_FONTS.map((value) => ({ value, label: HEADING_FONT_LABELS[value] }))} />
            </Field>
            <Field id="design-weight" label="Headline weight">
              <ChoiceSelect
                id="design-weight"
                value={String(form.headingWeight)}
                onValueChange={(value) => update((current) => ({ ...current, headingWeight: value === "theme" ? "theme" : (Number(value) as 600 | 800) }))}
                options={opts([["theme", "Theme"], ["600", "Semibold"], ["800", "Bold"]])}
              />
            </Field>
          </div>
        </Group>

        <Group title="Buttons">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="design-btn-shape" label="Shape">
              <ChoiceSelect
                id="design-btn-shape"
                value={form.button.shape}
                onValueChange={(shape) => update((current) => ({ ...current, button: { ...current.button, shape: shape as StoreDesignForm["button"]["shape"] } }))}
                options={opts([["theme", "Theme corners"], ["square", "Square"], ["rounded", "Rounded"], ["pill", "Pill"]])}
              />
            </Field>
            <Field id="design-btn-style" label="Style" error={problem?.field === "button.style" ? problem.message : null}>
              <ChoiceSelect
                id="design-btn-style"
                value={form.button.style}
                onValueChange={(style) => update((current) => ({ ...current, button: { ...current.button, style: style as StoreDesignForm["button"]["style"] } }))}
                options={opts([["filled", "Filled"], ["outline", "Outline"]])}
              />
            </Field>
          </div>
          <p className="text-sm text-mute">Button color is your accent color, set in Theme and color above.</p>
        </Group>

        <Group title="Cards">
          <Field id="design-radius" label={`Corners: ${form.radius === "theme" ? "theme" : `${form.radius}px`}`}>
            <div className="flex items-center gap-3">
              <input
                id="design-radius"
                type="range"
                min={0}
                max={RADIUS_MAX}
                step={2}
                value={form.radius === "theme" ? preset.radiusPx : form.radius}
                onChange={(event) => update((current) => ({ ...current, radius: Number(event.target.value) }))}
                className="w-full accent-[var(--blue)]"
              />
              {form.radius !== "theme" && (
                <Button type="button" variant="ghost" size="sm" onClick={() => update((current) => ({ ...current, radius: "theme" }))}>
                  Theme
                </Button>
              )}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="design-border" label="Border">
              <ChoiceSelect id="design-border" value={form.border} onValueChange={(border) => update((current) => ({ ...current, border: border as StoreDesignForm["border"] }))} options={opts([["theme", "Theme"], ["none", "None"], ["thin", "Thin"], ["thick", "Thick"]])} />
            </Field>
            <Field id="design-shadow" label="Shadow">
              <ChoiceSelect id="design-shadow" value={form.shadow} onValueChange={(shadow) => update((current) => ({ ...current, shadow: shadow as StoreDesignForm["shadow"] }))} options={opts([["theme", "Theme"], ["none", "None"], ["soft", "Soft"], ["hard", "Hard"]])} />
            </Field>
          </div>
        </Group>

        <Group title="Layout">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="design-layout" label="Page layout" hint="Any layout works with any theme.">
              <ChoiceSelect id="design-layout" value={form.layout} onValueChange={(layout) => update((current) => ({ ...current, layout: layout as StoreDesignForm["layout"] }))} options={LAYOUT_CHOICES.map((value) => ({ value, label: LAYOUT_LABELS[value] }))} />
            </Field>
            <Field id="design-products" label="Products" hint="Grid or one column, on the Stack layout.">
              <ChoiceSelect id="design-products" value={form.productView} onValueChange={(view) => update((current) => ({ ...current, productView: view as StoreDesignForm["productView"] }))} options={opts([["grid", "Grid"], ["list", "One column"]])} />
            </Field>
          </div>
        </Group>

        <Group title="Header">
          <Field id="design-header-align" label="Photo and name">
            <ChoiceSelect id="design-header-align" value={form.header.align} onValueChange={(align) => update((current) => ({ ...current, header: { ...current.header, align: align as StoreDesignForm["header"]["align"] } }))} options={opts([["theme", "As the layout places them"], ["center", "Centered"], ["left", "On the left"]])} />
          </Field>
          <ImageUploader id="design-cover" label="Cover image (optional)" kind="cover" shape="wide" value={form.header.cover ?? ""} onChange={(cover) => update((current) => ({ ...current, header: { ...current.header, cover } }))} hint="A wide banner at the top of your store. 3:1 works best." />
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
            <span className="text-sm font-semibold">Show social icons</span>
            <Switch checked={form.header.showSocial} onCheckedChange={(showSocial) => update((current) => ({ ...current, header: { ...current.header, showSocial } }))} aria-label="Show social icons" />
          </label>
        </Group>

        {problem && problem.field !== "button.style" && (
          <Alert variant="error" role="alert">
            <AlertDescription>{problem.message}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert variant={message.kind === "success" ? "success" : "error"} role={message.kind === "error" ? "alert" : "status"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={reset} disabled={saving}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Back to theme
          </Button>
          <Button type="button" onClick={() => parsed.success && save(parsed.data)} loading={saving} disabled={!parsed.success || problem !== null}>
            Save design
          </Button>
        </div>
      </div>
    </Card>
  );
}
