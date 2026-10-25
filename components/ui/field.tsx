import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertCircle } from "lucide-react"

// DESIGN.md 9.2. Link an error to its input with aria-describedby={id} and aria-invalid on the input.

/** Helper text under a field (Body S, muted). */
function FieldHint({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="field-hint" className={cn("text-sm text-mute", className)} {...props} />
}

/** Inline field error: icon plus text, never color alone. Announced when it appears. */
function FieldError({ className, children, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn("flex items-start gap-2 text-sm font-medium text-danger", className)}
      {...props}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

export { FieldHint, FieldError }
