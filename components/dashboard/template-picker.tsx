"use client";

import { Check, Undo2 } from "lucide-react";
import { useState } from "react";

import { LayoutThumb } from "@/components/store/layout-thumb";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { applyDesign } from "@/lib/store-design/rules";
import { STORE_TEMPLATES, type StoreTemplate } from "@/lib/store-templates/catalog";
import { THEME_PRESETS } from "@/lib/themes";

/**
 * The Templates tab of Store design (D-130): ready-made looks. "Use this template" fills the Theme,
 * Customize and (if ticked) Sections tabs with the template, so the preview shows it at once; nothing
 * is saved until Save, and "Undo" puts the previous design back. Products are never touched.
 */
export function TemplatePicker({ hasSections, onApply, onUndo, canUndo }: { hasSections: boolean; onApply: (template: StoreTemplate, withSections: boolean) => void; onUndo: () => void; canUndo: boolean }) {
  // Creators with their own sections keep them unless they ask for the samples.
  const [withSections, setWithSections] = useState(!hasSections);
  const [applied, setApplied] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3">Start from a template</h2>
        <p className="text-sm text-mute">Pick a look made for creators like you. You can change everything afterwards in Theme, Customize and Sections. Your products stay as they are.</p>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-line p-3">
        <Checkbox id="template-sections" checked={withSections} onCheckedChange={(value) => setWithSections(value === true)} className="mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="template-sections">Also use the template&apos;s sample sections</Label>
          <span className="text-sm text-mute">{hasSections ? "This replaces the sections you added (intro text, quotes, links)." : "An intro, a quote and links around your products, ready to edit."}</span>
        </div>
      </div>

      {applied && (
        <Alert variant="success" role="status">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>The template is in the preview. Change anything you like, then Save to publish it.</span>
            {canUndo && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  onUndo();
                  setApplied(null);
                }}
              >
                <Undo2 aria-hidden="true" className="size-4" />
                Undo
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {STORE_TEMPLATES.map((template) => {
          const look = { ...applyDesign(THEME_PRESETS[template.preset], template.design), accent: template.accent };
          const on = applied === template.id;
          return (
            <li key={template.id} className={`flex flex-col gap-3 rounded-lg border p-4 ${on ? "border-blue bg-blue-soft" : "border-line bg-surface"}`}>
              <div className="flex items-start gap-3">
                <LayoutThumb preset={look} />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold">{template.name}</span>
                  <Badge variant="example" className="self-start">
                    {template.bestFor}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-mute">{template.description}</p>
              <Button
                type="button"
                variant={on ? "secondary" : "default"}
                size="sm"
                className="mt-auto self-start"
                aria-label={`Use the ${template.name} template`}
                onClick={() => {
                  onApply(template, withSections);
                  setApplied(template.id);
                }}
              >
                {on && <Check aria-hidden="true" className="size-4" />}
                {on ? "In the preview" : "Use this template"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
