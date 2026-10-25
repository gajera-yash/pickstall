import { ChevronDown } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// Native <select> styled like Input (DESIGN.md 9.2): best keyboard and mobile behaviour for short lists.
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "h-12 w-full min-w-0 appearance-none rounded-sm border border-input bg-surface pr-12 pl-4 text-base text-ink",
          "transition-colors duration-(--dur-fast)",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-danger",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-mute" />
    </div>
  )
}

export { Select }
