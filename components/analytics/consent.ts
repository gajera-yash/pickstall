"use client";

import { useSyncExternalStore } from "react";

import { CONSENT_KEY, type AnalyticsChoice } from "@/lib/analytics/platform";

// The visitor's choice about Pickstall's analytics (D-133), kept in this browser's local storage
// (not a cookie). Components subscribe, so the banner, the tag and the Cookie Policy agree.

const listeners = new Set<() => void>();
let memory: AnalyticsChoice = null;

function read(): AnalyticsChoice {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : memory;
  } catch {
    return memory; // storage blocked: the choice holds for this page view
  }
}

export function setAnalyticsChoice(choice: AnalyticsChoice) {
  memory = choice;
  try {
    if (choice) window.localStorage.setItem(CONSENT_KEY, choice);
    else window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Private mode: kept in memory only.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** The current choice; null on the server and before the visitor chose. */
export function useAnalyticsChoice(): AnalyticsChoice {
  return useSyncExternalStore(subscribe, read, () => null);
}
