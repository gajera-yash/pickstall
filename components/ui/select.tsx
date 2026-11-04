import { ChevronDown } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// shadcn/ui native select, restyled like Input (DESIGN.md 9.2): best keyboard and mobile
// behaviour for short lists. `Select` is our earlier name for it.
function NativeSelect({ className, size = "default", ...props }: Omit<React.ComponentProps<"select">, "size"> & { size?: "sm" | "default" }) {
  return (
    <div data-slot="native-select-wrapper" className="group/native-select relative has-[select:disabled]:opacity-50">
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "h-11 w-full min-w-0 appearance-none rounded-md border border-line bg-input-soft pr-12 pl-4 text-field text-ink shadow-field data-[size=sm]:h-10 data-[size=sm]:text-sm",
          "transition-[border-color,box-shadow] duration-(--dur-fast) not-disabled:hover:border-input",
          "focus-visible:border-blue focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-glow",
          "disabled:cursor-not-allowed",
          "aria-invalid:border-danger",
          className
        )}
        {...props}
      />
      <ChevronDown aria-hidden="true" data-slot="native-select-icon" className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-mute" />
    </div>
  )
}

function NativeSelectOption(props: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />
}

const Select = NativeSelect

export { NativeSelect, NativeSelectOption, Select }
