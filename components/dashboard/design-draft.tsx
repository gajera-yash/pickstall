"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { PageBlock } from "@/lib/page-blocks/rules";
import type { StoreDesign } from "@/lib/store-design/rules";
import type { ThemePresetId } from "@/lib/themes";

// The store design being edited (D-062, D-125). The editors on the Store design page update it as
// the creator works; the live preview shows it before it is saved. Each editor also registers its
// save function here, so one Save button saves every part that changed.

/** `custom` is the creator's own design (D-123); `blocks` the page sections (D-101). */
export type DesignDraft = { themePreset: ThemePresetId; accent: string; custom: StoreDesign | null; blocks: PageBlock[] };

/** One editor's part: whether it has unsaved changes, and how to save them (true when saved). */
type Saver = { dirty: boolean; save: () => Promise<boolean> };

type DraftState = {
  /** The design to show: the edited one, or the saved one when nothing is being edited. */
  design: DesignDraft;
  /** True when any editor has unsaved changes. */
  unsaved: boolean;
  /** Changes part of the edited design (one click can change the theme and then its accent). */
  patch: (change: Partial<DesignDraft>) => void;
  /** Part of the edited design was saved: it becomes the saved one. */
  markSaved: (design: Partial<DesignDraft>) => void;
  /** Registers (or with null removes) an editor's saver. */
  setSaver: (id: string, saver: Saver | null) => void;
  /** Saves every editor with unsaved changes, one after the other. True when all saved. */
  saveAll: () => Promise<boolean>;
};

const DraftContext = createContext<DraftState | null>(null);

export function DesignDraftProvider({ saved: initialSaved, children }: { saved: DesignDraft; children: ReactNode }) {
  const [design, setDesign] = useState(initialSaved);
  const savers = useRef(new Map<string, Saver>());
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);

  const patch = useCallback((change: Partial<DesignDraft>) => setDesign((current) => ({ ...current, ...change })), []);
  const markSaved = useCallback((next: Partial<DesignDraft>) => {
    // Other unsaved edits stay; the saved part now matches what the editor holds.
    setDesign((current) => ({ ...current, ...next }));
  }, []);
  const setSaver = useCallback((id: string, saver: Saver | null) => {
    if (saver) savers.current.set(id, saver);
    else savers.current.delete(id);
    const dirty = saver?.dirty ?? false;
    setDirtyIds((current) => (dirty === current.includes(id) ? current : dirty ? [...current, id] : current.filter((item) => item !== id)));
  }, []);
  const saveAll = useCallback(async () => {
    let ok = true;
    for (const saver of [...savers.current.values()]) {
      if (saver.dirty && !(await saver.save())) ok = false;
    }
    return ok;
  }, []);

  const value = useMemo(() => ({ design, unsaved: dirtyIds.length > 0, patch, markSaved, setSaver, saveAll }), [design, dirtyIds, patch, markSaved, setSaver, saveAll]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

/** The design being edited. Outside a provider: null. */
export function useDesignDraft(): DraftState | null {
  return useContext(DraftContext);
}

/** Keeps this editor's saver up to date in the draft (no-op outside a provider). */
export function useSaver(id: string, dirty: boolean, save: () => Promise<boolean>): void {
  const draft = useDesignDraft();
  const setSaver = draft?.setSaver;
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  });
  useEffect(() => {
    setSaver?.(id, { dirty, save: () => latest.current() });
  }, [setSaver, id, dirty]);
  useEffect(() => () => setSaver?.(id, null), [setSaver, id]);
}
