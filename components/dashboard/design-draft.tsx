"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { StoreDesign } from "@/lib/store-design/rules";
import type { ThemePresetId } from "@/lib/themes";

// The page design being edited (D-062). The Page design form updates it as the creator picks a
// theme or color; the store preview on the right of My Store shows it before it is saved, so there
// is one preview instead of two.

/** `custom` is the creator's own design on top of the theme (D-123); null follows the theme. */
export type DesignDraft = { themePreset: ThemePresetId; accent: string; custom: StoreDesign | null };

type DraftState = {
  /** The design to show: the edited one, or the saved one when nothing is being edited. */
  design: DesignDraft;
  /** True when it differs from what is saved. */
  unsaved: boolean;
  /** Changes part of the edited design (one click can change the theme and then its accent). */
  patch: (change: Partial<DesignDraft>) => void;
  /** Part of the edited design was saved (the theme, or the custom design): it becomes the saved one. */
  markSaved: (design: Partial<DesignDraft>) => void;
};

const DraftContext = createContext<DraftState | null>(null);

const same = (a: DesignDraft, b: DesignDraft) => a.themePreset === b.themePreset && a.accent.toUpperCase() === b.accent.toUpperCase() && JSON.stringify(a.custom) === JSON.stringify(b.custom);

export function DesignDraftProvider({ saved: initialSaved, children }: { saved: DesignDraft; children: ReactNode }) {
  const [saved, setSaved] = useState(initialSaved);
  const [design, setDesign] = useState(initialSaved);
  const patch = useCallback((change: Partial<DesignDraft>) => setDesign((current) => ({ ...current, ...change })), []);
  const markSaved = useCallback((next: Partial<DesignDraft>) => {
    setSaved((current) => ({ ...current, ...next }));
    // Other unsaved edits (the theme while saving the custom design, or the other way) stay.
    setDesign((current) => ({ ...current, ...next }));
  }, []);
  const value = useMemo(() => ({ design, unsaved: !same(design, saved), patch, markSaved }), [design, saved, patch, markSaved]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

/** The design being edited. Outside a provider (the setup wizard): null. */
export function useDesignDraft(): DraftState | null {
  return useContext(DraftContext);
}
