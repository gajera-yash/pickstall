import * as React from "react"

import { cn } from "@/lib/utils"

// shadcn/ui textarea, styled like Input (DESIGN.md 9.2). Always pair with a visible <Label>.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full min-w-0 resize-y rounded-md border border-field-border bg-input-fill px-4 py-3 text-field text-ink shadow-field",
        "placeholder:text-mute",
        "transition-[border-color,box-shadow] duration-(--dur-fast) not-disabled:hover:border-input",
        "focus-visible:border-blue focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-glow",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
