"use client"

import { OTPInput, OTPInputContext } from "input-otp"
import * as React from "react"

import { cn } from "@/lib/utils"

// shadcn/ui input OTP (on the input-otp package), restyled per DESIGN.md 9.2: one box per digit,
// 1px --border-input, the active box ringed in --blue, --danger border when invalid. Paste, the
// phone's one-time-code autofill and arrow keys are handled by input-otp.

function InputOTP({ className, containerClassName, ...props }: React.ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn("flex items-center gap-2 has-disabled:opacity-50", containerClassName)}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="input-otp-group" className={cn("flex items-center gap-2", className)} {...props} />
}

function InputOTPSlot({ index, className, ...props }: React.ComponentProps<"div"> & { index: number }) {
  const context = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = context?.slots[index] ?? {}
  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "relative flex h-13 w-11 items-center justify-center rounded-md border border-line bg-input-soft font-display text-h3 tabular-nums shadow-field transition-[border-color,box-shadow] duration-(--dur-fast)",
        "aria-invalid:border-danger data-[active=true]:z-10 data-[active=true]:border-blue data-[active=true]:ring-4 data-[active=true]:ring-focus-glow",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-px animate-caret-blink bg-ink duration-1000 motion-reduce:animate-none" />
        </div>
      )}
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot }
