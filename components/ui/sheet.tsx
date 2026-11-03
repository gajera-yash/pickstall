"use client"

import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

// shadcn/ui sheet, restyled per DESIGN.md 9.7: a right-side drawer on larger screens and a bottom
// sheet on phones, surface with 1px border, popover shadow and scrim. Radix traps focus, closes on
// Esc and returns focus.

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetContent({ className, children, ...props }: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-(--scrim) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex w-full flex-col border-line bg-surface text-ink shadow-popover outline-hidden",
          "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-lg border-t pb-[env(safe-area-inset-bottom)]",
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:max-w-[480px] sm:rounded-none sm:border-t-0 sm:border-l",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:slide-in-from-right-8",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          "motion-reduce:animate-none",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className="absolute top-3 right-3 flex size-11 cursor-pointer items-center justify-center rounded-md text-mute transition-colors duration-(--dur-fast) hover:bg-bg-subtle hover:text-ink"
          aria-label="Close"
        >
          <XIcon aria-hidden="true" className="size-5" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1 border-b border-line px-5 py-4 pr-16 sm:px-6", className)} {...props} />
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-body" className={cn("flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5 sm:px-6", className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn("font-display text-h3", className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description data-slot="sheet-description" className={cn("text-sm text-mute", className)} {...props} />
}

export { Sheet, SheetClose, SheetContent, SheetHeader, SheetBody, SheetTitle, SheetDescription }
