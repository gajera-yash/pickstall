"use client"

import { Slider as SliderPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

// shadcn/ui slider (Radix), restyled to the DESIGN tokens: a 6px --line track, --blue range and a
// 24px thumb (44px touch target from the track's height). Arrow keys, Page Up/Down, Home and End work.
// `thumb` goes on every thumb: that is where aria-label / aria-labelledby and aria-valuetext belong.
function Slider({ className, defaultValue, value, min = 0, max = 100, thumb, ...props }: React.ComponentProps<typeof SliderPrimitive.Root> & { thumb?: React.ComponentProps<typeof SliderPrimitive.Thumb> }) {
  const values = React.useMemo(() => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]), [value, defaultValue, min])
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn("relative flex h-11 w-full touch-none items-center select-none data-[disabled]:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-line">
        <SliderPrimitive.Range data-slot="slider-range" className="absolute h-full bg-blue" />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          {...thumb}
          className="block size-6 shrink-0 cursor-pointer rounded-full border-2 border-blue bg-surface shadow-popover transition-transform duration-(--dur-fast) hover:scale-110 disabled:pointer-events-none"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
