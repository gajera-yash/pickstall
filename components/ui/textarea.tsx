import * as React from "react"

import { cn } from "@/lib/utils"

// Styled like Input (DESIGN.md 9.2). Always pair with a visible <Label>.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full min-w-0 resize-y rounded-sm border border-input bg-surface px-4 py-3 text-base text-ink",
        "placeholder:text-mute",
        "transition-colors duration-(--dur-fast)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
