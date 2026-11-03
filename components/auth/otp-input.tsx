"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { normalizeCodeInput } from "@/lib/auth/code";
import { OTP_LENGTH } from "@/lib/config";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (code: string) => void;
  labelledBy: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
};

/**
 * Six one-digit boxes for the email code (DESIGN.md 10.7), on the shadcn Input OTP. It is one real
 * input underneath, so typing, Backspace, arrow keys, paste ("123-456" too) and the phone's
 * one-time-code autofill all work. The value lives in the parent; the form submits it through a
 * hidden input there.
 */
export function OtpInput({ value, onChange, labelledBy, describedBy, invalid, disabled }: Props) {
  return (
    <InputOTP
      id="code"
      maxLength={OTP_LENGTH}
      pattern={REGEXP_ONLY_DIGITS}
      pasteTransformer={normalizeCodeInput}
      autoComplete="one-time-code"
      autoFocus
      value={value}
      onChange={(code) => onChange(normalizeCodeInput(code))}
      disabled={disabled}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid ? true : undefined}
      containerClassName="justify-center"
    >
      <InputOTPGroup className="gap-2 sm:gap-3">
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            aria-invalid={invalid ? true : undefined}
            className={cn("size-12 sm:size-14", value[index] && !invalid && "border-blue bg-blue-soft", invalid && "bg-danger-soft")}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
