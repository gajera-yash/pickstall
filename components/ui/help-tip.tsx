"use client";

import { CircleHelp } from "lucide-react";
import { useId } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A small "?" next to a label that explains a tricky field in one or two sentences (D-128). Opens on
 * hover and on keyboard focus; the text is also the button's accessible description.
 */
export function HelpTip({ label, children }: { label: string; children: string }) {
  const id = useId();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`Help: ${label}`} aria-describedby={id} className="inline-flex size-5 items-center justify-center rounded-full text-mute hover:text-ink focus-visible:ring-2 focus-visible:ring-blue focus-visible:outline-none">
          <CircleHelp aria-hidden="true" className="size-4" />
          <span id={id} className="sr-only">
            {children}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{children}</TooltipContent>
    </Tooltip>
  );
}
