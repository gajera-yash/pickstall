import * as React from "react"
import { cn } from "@/lib/utils"

// shadcn/ui input, restyled per DESIGN.md 9.2: 44px high, radius md, 1px soft --border-field (3:1, D-059), never use the placeholder as the label.
// Text is 16px (text-field) so phones do not zoom in on focus.
// Error state: set aria-invalid and aria-describedby pointing at a <FieldError>.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-field-border bg-input-fill px-4 text-field text-ink shadow-field",
        "placeholder:text-mute selection:bg-primary selection:text-primary-foreground",
        // Soft field (D-059): a darker border on hover, a blue border and soft glow on focus.
        "transition-[border-color,box-shadow] duration-(--dur-fast) not-disabled:hover:border-input",
        "focus-visible:border-blue focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-glow",
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
