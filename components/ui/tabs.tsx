"use client"

import { Tabs as TabsPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

// shadcn/ui tabs, restyled per DESIGN.md 9.8: underline style, active tab has a 2px blue underline
// and ink text, inactive tabs are muted. Arrow keys move between tabs (Radix).

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-5", className)} {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex gap-6 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 border-transparent text-sm font-medium whitespace-nowrap text-mute",
        "transition-colors duration-(--dur-fast) hover:text-ink",
        "data-[state=active]:border-blue data-[state=active]:font-semibold data-[state=active]:text-ink",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex flex-col gap-5", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
