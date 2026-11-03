"use client";

import { useEffect, useState } from "react";

/** How long a "saved" confirmation stays on screen. Long enough to read, short enough not to linger. */
export const SUCCESS_MESSAGE_MS = 5000;

/**
 * True while a success message for `key` should show: from the moment `key` appears (a new result
 * object from a server action, say) until `ms` later. A new key shows the message again. Pass null
 * when there is nothing to confirm.
 */
export function useAutoHide(key: object | string | null | undefined, ms = SUCCESS_MESSAGE_MS): boolean {
  const [hiddenKey, setHiddenKey] = useState<typeof key>(null);

  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => setHiddenKey(key), ms);
    return () => clearTimeout(timer);
  }, [key, ms]);

  return Boolean(key) && hiddenKey !== key;
}
