"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// shadcn/ui Switch (Radix), restyled to DESIGN.md tokens: blue when on, a 3:1 input border when
// off. 44px hit area comes from the label it sits in; focus ring from the global :focus-visible rule.
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-(--dur-fast)",
        "data-[state=checked]:bg-blue data-[state=unchecked]:border-input data-[state=unchecked]:bg-bg-subtle",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-surface shadow-popover ring-0 transition-transform duration-(--dur-fast) ease-(--ease-out)",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
