import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

import { Spinner } from "@/components/ui/spinner"

// shadcn/ui button, restyled per DESIGN.md 9.1 (white theme, D-007). One primary button per view. Focus ring comes from the global :focus-visible rule.
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-5 text-button whitespace-nowrap select-none",
    "transition-[background-color,box-shadow,translate] duration-(--dur-fast) ease-(--ease-out)",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground not-disabled:hover:bg-blue-hover not-disabled:active:bg-blue-active",
        secondary:
          "border border-input bg-surface text-ink not-disabled:hover:bg-bg-subtle",
        ghost: "text-ink not-disabled:hover:bg-bg-subtle",
        destructive: "bg-danger text-on-danger not-disabled:hover:opacity-90",
        // Marketing landing only (DESIGN.md 7): never in the app.
        highlight:
          "border-2 border-on-yellow bg-yellow text-on-yellow not-disabled:hover:-translate-x-px not-disabled:hover:-translate-y-px not-disabled:hover:shadow-hard-sm",
        link: "px-0 text-blue underline underline-offset-4 not-disabled:hover:text-blue-hover",
      },
      size: {
        sm: "h-9 px-4",
        default: "h-11",
        lg: "h-13",
        icon: "size-11 px-0",
        "icon-sm": "size-9 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner, sets aria-busy and blocks clicks. The label stays. */
    loading?: boolean
  }

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Spinner aria-hidden="true" role={undefined} aria-label={undefined} className="size-5" />}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
