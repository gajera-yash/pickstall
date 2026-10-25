import type { ReactNode } from "react"

import { FieldError, FieldHint } from "@/components/ui/field"
import { Label } from "@/components/ui/label"

/**
 * Label above the field, then the field, then the error (or the hint when there is no error).
 * Give the input `id` and `aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}`.
 */
function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string | null
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint ? <FieldHint id={`${id}-hint`}>{hint}</FieldHint> : null}
    </div>
  )
}

/** The aria-describedby value that goes with FormField. */
function describedBy(id: string, error?: string | null, hint?: string): string | undefined {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined
}

export { FormField, describedBy }
