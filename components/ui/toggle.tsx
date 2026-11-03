"use client"

import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

// shadcn/ui toggle (Radix), restyled per DESIGN.md 9.3. The "segment" variant is the segmented
// control: the chosen segment is --blue-soft with --ink text and a 1px --blue border.
const toggleVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm text-sm font-semibold whitespace-nowrap transition-colors duration-(--dur-fast) disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "text-mute hover:text-ink data-[state=on]:bg-blue-soft data-[state=on]:text-ink",
        segment: "border border-transparent text-mute hover:text-ink data-[state=on]:border-blue data-[state=on]:bg-blue-soft data-[state=on]:text-ink",
        outline: "border border-input bg-surface text-ink hover:bg-bg-subtle data-[state=on]:border-blue data-[state=on]:bg-blue-soft",
        // No state styles: the item draws its own selected look (the landing's animated highlights).
        bare: "",
      },
      size: {
        default: "min-h-10 px-3",
        sm: "min-h-9 px-2.5",
        lg: "min-h-11 px-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Toggle({ className, variant, size, ...props }: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive.Root data-slot="toggle" className={cn(toggleVariants({ variant, size, className }))} {...props} />
}

export { Toggle, toggleVariants }
