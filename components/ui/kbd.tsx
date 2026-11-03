import * as React from "react"

import { cn } from "@/lib/utils"

// shadcn/ui kbd: a keyboard key, such as the ⌘K shortcut hint.
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn("pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-sm border border-line bg-bg-subtle px-1 font-sans text-xs font-semibold text-mute select-none", className)}
      {...props}
    />
  )
}

export { Kbd }
