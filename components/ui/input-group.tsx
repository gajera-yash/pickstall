"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// shadcn/ui input group, restyled per DESIGN.md 9.2: one 44px field (radius md, 1px --border-input)
// holding the input and its icons or text. The whole group shows the focus ring and the error border.

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group relative flex h-11 w-full min-w-0 items-center rounded-md border border-input bg-surface text-ink transition-colors duration-(--dur-fast)",
        "has-[>[data-align=inline-start]]:[&>input]:pl-2 has-[>[data-align=inline-end]]:[&>input]:pr-2",
        // The focus ring sits on the group, not on the bare input inside it.
        "has-[[data-slot=input-group-control]:focus-visible]:outline-3 has-[[data-slot=input-group-control]:focus-visible]:outline-offset-2 has-[[data-slot=input-group-control]:focus-visible]:outline-blue",
        "has-[[data-slot][aria-invalid=true]]:border-danger",
        "has-[[data-slot=input-group-control]:disabled]:opacity-50",
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 text-sm font-medium text-mute select-none [&>svg:not([class*='size-'])]:size-5",
  {
    variants: {
      align: {
        "inline-start": "order-first pl-4",
        "inline-end": "order-last pr-4",
      },
    },
    defaultVariants: { align: "inline-start" },
  }
)

function InputGroupAddon({ className, align = "inline-start", ...props }: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return
        event.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("flex items-center gap-2 text-sm text-mute [&_svg]:pointer-events-none", className)} {...props} />
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn("h-full flex-1 rounded-none border-0 bg-transparent text-inherit focus-visible:outline-none", className)}
      {...props}
    />
  )
}

export { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText }
