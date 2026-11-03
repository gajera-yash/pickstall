import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// shadcn/ui badge, restyled per DESIGN.md 9.5: pill, Caption weight 600, always with text (never color alone).
const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", {
  variants: {
    variant: {
      live: "bg-mint-soft text-mint",
      draft: "bg-bg-subtle text-mute",
      soon: "bg-yellow text-on-yellow",
      example: "border border-line bg-bg-subtle text-mute",
      testMode: "bg-yellow-soft text-warning",
      danger: "bg-danger-soft text-danger",
    },
  },
  defaultVariants: { variant: "draft" },
})

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
