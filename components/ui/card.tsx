import * as React from "react"
import { cn } from "@/lib/utils"

// DESIGN.md 9.4: surface, soft 1px border (--border-ui), radius lg, 20-24px padding. Border only
// (no shadow) in the app; marketing cards may add shadow-hard-md. Do not nest cards.
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("flex flex-col gap-6 rounded-lg border border-border-ui bg-surface p-5 text-ink sm:p-6", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-2", className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("flex flex-col gap-6", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex flex-col gap-2 text-xs font-medium text-mute", className)} {...props} />
}

export { Card, CardHeader, CardContent, CardFooter }
