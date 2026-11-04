"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { ThemePresetId } from "@/lib/themes";

// The page design being edited (D-062). The Page design form updates it as the creator picks a
// theme or color; the store preview on the right of My Store shows it before it is saved, so there
// is one preview instead of two.

export type DesignDraft = { themePreset: ThemePresetId; accent: string };

type DraftState = {
  /** The design to show: the edited one, or the saved one when nothing is being edited. */
  design: DesignDraft;
  /** True when it differs from what is saved. */
  unsaved: boolean;
  /** Changes part of the edited design (one click can change the theme and then its accent). */
  patch: (change: Partial<DesignDraft>) => void;
  /** The edited design was saved: it becomes the saved one. */
  markSaved: (design: DesignDraft) => void;
};

const DraftContext = createContext<DraftState | null>(null);

const same = (a: DesignDraft, b: DesignDraft) => a.themePreset === b.themePreset && a.accent.toUpperCase() === b.accent.toUpperCase();

export function DesignDraftProvider({ saved: initialSaved, children }: { saved: DesignDraft; children: ReactNode }) {
  const [saved, setSaved] = useState(initialSaved);
  const [design, setDesign] = useState(initialSaved);
  const patch = useCallback((change: Partial<DesignDraft>) => setDesign((current) => ({ ...current, ...change })), []);
  const markSaved = useCallback((next: DesignDraft) => {
    setSaved(next);
    setDesign(next);
  }, []);
  const value = useMemo(() => ({ design, unsaved: !same(design, saved), patch, markSaved }), [design, saved, patch, markSaved]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

/** The design being edited. Outside a provider (the setup wizard): null. */
export function useDesignDraft(): DraftState | null {
  return useContext(DraftContext);
}
