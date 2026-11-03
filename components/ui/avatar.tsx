"use client"

import { Avatar as AvatarPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

// shadcn/ui avatar (Radix): the image, or the fallback (an initial on --blue-soft) while it loads
// or when there is none.

function Avatar({ className, size = "default", ...props }: React.ComponentProps<typeof AvatarPrimitive.Root> & { size?: "default" | "sm" | "lg" }) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn("group/avatar relative flex size-9 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-12 data-[size=sm]:size-7", className)}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image data-slot="avatar-image" className={cn("aspect-square size-full object-cover", className)} {...props} />
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("flex size-full items-center justify-center rounded-full bg-blue-soft font-display text-sm font-bold text-ink group-data-[size=sm]/avatar:text-xs", className)}
      {...props}
    />
  )
}

export { Avatar, AvatarFallback, AvatarImage }
