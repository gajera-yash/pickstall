"use client"

import { Progress as ProgressPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

// DESIGN.md 9.10: 6px bar, radius full, --line track, --blue fill. Always show the value as text
// next to it ("1 of 4 done") and pass the same text as aria-valuetext.
function Progress({ className, value, max = 100, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const percent = max > 0 ? Math.min(100, Math.max(0, ((value ?? 0) / max) * 100)) : 0
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-line", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full rounded-full bg-blue transition-[width] duration-(--dur-slow) ease-(--ease-out)"
        style={{ width: `${percent}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
