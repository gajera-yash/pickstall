"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useTours } from "@/components/tours/tour-provider";
import { HOTSPOTS, type HotspotId } from "@/lib/tours/catalog";
import { cn } from "@/lib/utils";

/**
 * A "New" dot next to a new feature (D-128). Clicking it explains the feature; "Got it" (or opening
 * the feature's own link with `markOnClick`) hides it for good. Hidden during setup and once seen.
 */
export function Hotspot({ id, className }: { id: HotspotId; className?: string }) {
  const tours = useTours();
  if (!tours?.enabled || !tours.seen || tours.seen.has(id)) return null;
  const { title, body } = HOTSPOTS[id];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${title}: what's this?`}
          className={cn("relative inline-flex size-6 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-blue focus-visible:outline-none", className)}
        >
          <span aria-hidden="true" className="absolute inline-flex size-3 animate-ping rounded-full bg-blue opacity-60 motion-reduce:hidden" />
          <span aria-hidden="true" className="relative inline-flex size-2.5 rounded-full bg-blue" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex flex-col gap-2">
        <p className="font-display text-h4">{title}</p>
        <p className="text-sm text-mute">{body}</p>
        <Button type="button" size="sm" className="self-end" onClick={() => tours.markSeen(id)}>
          Got it
        </Button>
      </PopoverContent>
    </Popover>
  );
}
