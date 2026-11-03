import type { LucideIcon } from "lucide-react"
import * as React from "react"

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

// Input with a leading icon (Stan-style fields), built on the shadcn input group. The icon is
// decoration only: keep a visible <Label>. `end` holds a trailing control, such as a show-password button.
function IconInput({ icon: Icon, className, end, ...props }: React.ComponentProps<"input"> & { icon: LucideIcon; end?: React.ReactNode }) {
  return (
    <InputGroup className={className}>
      <InputGroupInput {...props} />
      <InputGroupAddon>
        <Icon aria-hidden="true" />
      </InputGroupAddon>
      {end && <InputGroupAddon align="inline-end" className="pr-1">{end}</InputGroupAddon>}
    </InputGroup>
  )
}

export { IconInput }
