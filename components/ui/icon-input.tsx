import type { LucideIcon } from "lucide-react"
import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Input with a leading icon (Stan-style fields). The icon is decoration only: keep a visible <Label>.
function IconInput({
  icon: Icon,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { icon: LucideIcon }) {
  return (
    <div className="relative">
      <Icon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-mute" />
      <Input className={cn("pl-12", className)} {...props} />
    </div>
  )
}

export { IconInput }
