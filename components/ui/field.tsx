import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle } from "lucide-react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// shadcn/ui field, restyled per DESIGN.md 9.2 and 9.13: label above the control, helper text in
// Body S muted, errors with an icon (never color alone). Link an error to its control with
// aria-describedby and set aria-invalid on the control.

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn("flex min-w-0 flex-col gap-3 has-[>[data-slot=radio-group]]:gap-3", className)}
      {...props}
    />
  )
}

function FieldLegend({ className, variant = "label", ...props }: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn("mb-2 data-[variant=label]:text-sm data-[variant=label]:font-semibold data-[variant=legend]:font-display data-[variant=legend]:text-h4", className)}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-group" className={cn("group/field-group flex w-full flex-col gap-5", className)} {...props} />
}

const fieldVariants = cva("group/field flex w-full gap-2", {
  variants: {
    orientation: {
      vertical: "flex-col",
      horizontal: "flex-row items-center [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:items-start",
    },
  },
  defaultVariants: { orientation: "vertical" },
})

function Field({ className, orientation = "vertical", ...props }: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return <div role="group" data-slot="field" data-orientation={orientation} className={cn(fieldVariants({ orientation }), className)} {...props} />
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-content" className={cn("flex flex-1 flex-col gap-1 leading-snug", className)} {...props} />
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "w-fit group-data-[disabled=true]/field:opacity-50",
        // A label wrapping a whole field becomes a selectable card (radio and checkbox choices).
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border has-[>[data-slot=field]]:border-line [&>[data-slot=field]]:p-4",
        "has-data-[state=checked]:border-blue has-data-[state=checked]:bg-blue-soft",
        className
      )}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-title" className={cn("flex w-fit items-center gap-2 text-sm font-semibold leading-snug", className)} {...props} />
}

/** Helper text under a field (Body S, muted). */
function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="field-description" className={cn("text-sm text-mute [&>a]:underline [&>a]:underline-offset-4", className)} {...props} />
}

/** Inline field error: icon plus text, never color alone. Announced when it appears. */
function FieldError({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null
  return (
    <p data-slot="field-error" role="alert" className={cn("flex items-start gap-2 text-sm font-medium text-danger", className)} {...props}>
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** Our earlier name for FieldDescription, kept for the existing forms. */
const FieldHint = FieldDescription

export { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldHint, FieldLabel, FieldLegend, FieldSet, FieldTitle }
