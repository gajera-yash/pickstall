import * as React from "react"
import { cn } from "@/lib/utils"

// shadcn/ui input, restyled per DESIGN.md 9.2: 44px high, radius md, 1px --border-input (3:1), never use the placeholder as the label.
// Text is 16px (text-field) so phones do not zoom in on focus.
// Error state: set aria-invalid and aria-describedby pointing at a <FieldError>.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-input bg-surface px-4 text-field text-ink",
        "placeholder:text-mute selection:bg-primary selection:text-primary-foreground",
        "transition-colors duration-(--dur-fast)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger",
        "file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input }
