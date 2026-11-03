import * as React from "react"
import { cn } from "@/lib/utils"

// shadcn/ui skeleton, restyled per DESIGN.md 9.10: --line blocks with a slow pulse (stopped under prefers-reduced-motion by globals.css).
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn("animate-pulse rounded-sm bg-line", className)} {...props} />
}

export { Skeleton }
