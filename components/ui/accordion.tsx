"use client"

import { ChevronDownIcon } from "lucide-react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

// shadcn/ui accordion (Radix), restyled to the DESIGN tokens: 1px --line separators, a chevron
// that turns when open, and the open/close height animation (off under prefers-reduced-motion).

function Accordion(props: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item data-slot="accordion-item" className={cn("border-b border-line last:border-b-0", className)} {...props} />
}

/** `icon` replaces the chevron; it can turn with `group-data-[state=open]/accordion-trigger:`. */
function AccordionTrigger({ className, children, icon, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger> & { icon?: React.ReactNode }) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger flex min-h-11 flex-1 cursor-pointer items-center justify-between gap-4 py-3 text-left font-semibold transition-colors duration-(--dur-fast) disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        {icon ?? <ChevronDownIcon aria-hidden="true" className="pointer-events-none size-4 shrink-0 text-mute transition-transform duration-(--dur-fast) group-data-[state=open]/accordion-trigger:rotate-180" />}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none"
      {...props}
    >
      <div className={cn("pt-0 pb-4 text-sm", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
