import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react"

// DESIGN.md 9.11: icon + title + text, 1px border, radius md. Place it inline above the affected form.
const alertVariants = cva("flex items-start gap-3 rounded-md border p-4 text-ink", {
  variants: {
    variant: {
      info: "border-blue bg-blue-soft",
      success: "border-mint bg-mint-soft",
      warning: "border-warning bg-warning-soft",
      error: "border-danger bg-danger-soft",
    },
  },
  defaultVariants: { variant: "info" },
})

const icons = {
  info: { Icon: Info, color: "text-blue" },
  success: { Icon: CheckCircle2, color: "text-mint" },
  warning: { Icon: TriangleAlert, color: "text-warning" },
  error: { Icon: AlertCircle, color: "text-danger" },
} as const

function Alert({
  className,
  variant = "info",
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const { Icon, color } = icons[variant ?? "info"]
  const urgent = variant === "error" || variant === "warning"

  return (
    <div
      data-slot="alert"
      role={urgent ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", color)} />
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="alert-title" className={cn("font-display text-h4", className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="alert-description" className={cn("text-sm", className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription }
