import * as React from "react"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

// shadcn/ui spinner. Stops spinning under prefers-reduced-motion. Pass aria-hidden when a label
// next to it already says what is loading (as in Button).
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return <Loader2Icon role="status" aria-label="Loading" className={cn("size-4 animate-spin motion-reduce:animate-none", className)} {...props} />
}

export { Spinner }
