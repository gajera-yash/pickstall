"use client";

import { createContext, useContext, useState, type ComponentProps } from "react";

const RemoveRowContext = createContext<(() => void) | null>(null);

/**
 * A list row that a control inside it can hide at once (for example after Delete), without waiting
 * for the refreshed list from the server (QA 2026-11: a deleted product stayed listed for seconds).
 */
export function RemovableRow(props: ComponentProps<"li">) {
  const [removed, setRemoved] = useState(false);
  if (removed) return null;
  return (
    <RemoveRowContext.Provider value={() => setRemoved(true)}>
      <li {...props} />
    </RemoveRowContext.Provider>
  );
}

/** Hides the surrounding RemovableRow; does nothing outside one. */
export function useRemoveRow(): () => void {
  return useContext(RemoveRowContext) ?? noop;
}

function noop() {}
