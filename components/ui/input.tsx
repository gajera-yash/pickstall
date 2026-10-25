import * as React from "react"
import { cn } from "cn"

// DESIGN.md 9.2: 48px high, 2px strong border, never use the placeholder as the label.
// Error state: set aria-invalid and aria-describedby pointing at a <FieldError>.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-sm border-2 border-input bg-surface px-4 text-base text-ink",
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
