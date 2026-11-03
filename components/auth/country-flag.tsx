"use client";

import { Globe } from "lucide-react";
import type * as React from "react";
import { useSyncExternalStore } from "react";

import type { PhoneCountry } from "@/lib/phone";
import { cn } from "@/lib/utils";

type FlagComponent = (props: { className?: string; title?: string }) => React.JSX.Element;
type FlagSet = Record<string, FlagComponent | undefined>;

// The 272 flags are about 870 KB of SVG components, so they are not part of the page bundle:
// they load in the background the first time a flag is shown, once for the whole app.
let flags: FlagSet | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  loading ??= import("country-flag-icons/react/3x2")
    .then((module) => {
      flags = module as unknown as FlagSet;
    })
    .catch(() => {
      // Offline or a failed chunk: keep the placeholder and try again on the next mount.
      loading = null;
    })
    .finally(() => listeners.forEach((notify) => notify()));
  return () => listeners.delete(listener);
}

/** Country flag (SVG, never emoji: DESIGN.md 0.7). Decorative: the name or dial code is always next to it. */
/** `country` is an ISO country code (or "EU"); the currency picker passes non-phone codes too. */
export function CountryFlag({ country, className }: { country: PhoneCountry | (string & {}); className?: string }) {
  const loaded = useSyncExternalStore(subscribe, () => flags, () => null);
  const Flag = loaded?.[country];
  return (
    <span aria-hidden="true" className={cn("flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-subtle", className)}>
      {Flag ? <Flag className="h-full w-auto max-w-none" /> : loaded ? <Globe className="size-4 text-mute" /> : null}
    </span>
  );
}
