"use client";

import { useLinkStatus } from "next/link";
import { useEffect } from "react";

import { Spinner } from "@/components/ui/spinner";

/**
 * A spinner on the setup step the creator just picked, until the next step has loaded (D-091).
 * Must sit inside that step's <Link>.
 */
export function StepPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="absolute top-2 right-2 flex items-center gap-1 text-xs text-mute">
      <Spinner aria-hidden="true" role={undefined} aria-label={undefined} className="size-4 text-blue" />
      <span className="sr-only">Loading this step</span>
    </span>
  );
}

/** Scrolls to the top of the page whenever the setup step changes (D-091). */
export function ScrollToTopOnStep({ step }: { step: string }) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);
  return null;
}
