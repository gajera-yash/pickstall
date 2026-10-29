"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

import { enterCodeDigits, eraseCodeDigit } from "@/lib/auth/code";
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
 * Six one-digit boxes for the email code (DESIGN.md 10.7). Typing moves to the next box, Backspace
 * moves back, and paste or one-time-code autofill fills every box at once. The value lives in the
 * parent; the form submits it through a hidden input there.
 */
export function OtpInput({ value, onChange, labelledBy, describedBy, invalid, disabled }: Props) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const focusBox = (index: number) => {
    const box = boxes.current[index];
    box?.focus();
    box?.select();
  };

  const apply = (result: { code: string; focus: number }) => {
    onChange(result.code);
    requestAnimationFrame(() => focusBox(result.focus));
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      apply(eraseCodeDigit(value, index));
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight" && index < Math.min(value.length, OTP_LENGTH - 1)) {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const onPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    apply(enterCodeDigits(value, index, event.clipboardData.getData("text")));
  };

  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="flex justify-center gap-2 sm:gap-3">
      {Array.from({ length: OTP_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          id={index === 0 ? "code" : undefined}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={index === 0}
          maxLength={OTP_LENGTH}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
          aria-invalid={invalid ? true : undefined}
          value={value[index] ?? ""}
          // Boxes after the first empty one send focus back to it, so the code stays contiguous.
          onFocus={() => {
            if (index > value.length) focusBox(value.length);
          }}
          onChange={(event) => apply(enterCodeDigits(value, index, event.target.value.replace(value[index] ?? "", "")))}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={(event) => onPaste(index, event)}
          className={cn(
            "size-12 min-w-0 rounded-md border border-input bg-surface text-center font-display text-h3 font-bold text-ink tabular-nums sm:size-14",
            "transition-colors duration-(--dur-fast) focus-visible:border-blue",
            "disabled:cursor-not-allowed disabled:opacity-50",
            value[index] && "border-blue bg-blue-soft",
            "aria-invalid:border-danger aria-invalid:bg-danger-soft",
          )}
        />
      ))}
    </div>
  );
}
