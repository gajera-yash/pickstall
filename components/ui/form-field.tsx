import type { ReactNode } from "react"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"

/**
 * Label above the field, then the field, then the error (or the hint when there is no error),
 * built from the shadcn Field parts. Give the input `id` and
 * `aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}`.
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
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint ? <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription> : null}
    </Field>
  )
}

/** The aria-describedby value that goes with FormField. */
function describedBy(id: string, error?: string | null, hint?: string): string | undefined {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined
}

export { FormField, describedBy }
