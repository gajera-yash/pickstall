import { OTP_LENGTH } from "@/lib/config";

/** Keeps digits only and caps the length, so pasting "123 456" or "123-456" works. */
export function normalizeCodeInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

/** Whole seconds left until `endsAtMs` (rounded up), never below 0. Used for the resend cooldown. */
export function secondsRemaining(endsAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
}

/**
 * What typing or pasting `typed` into box `index` of the 6-box code input does: the new code and
 * the box to focus next. Several digits (paste, SMS or email autofill) fill from that box on.
 * The code is always contiguous, so a box is never filled after an empty one.
 */
export function enterCodeDigits(code: string, index: number, typed: string): { code: string; focus: number } {
  const digits = typed.replace(/\D/g, "");
  if (digits === "") return { code, focus: index };
  const start = Math.min(index, code.length);
  const next = (code.slice(0, start) + digits + code.slice(start + digits.length)).slice(0, OTP_LENGTH);
  return { code: next, focus: Math.min(start + digits.length, OTP_LENGTH - 1) };
}

/** Backspace in box `index`: clears that box, or the previous one when it is already empty. */
export function eraseCodeDigit(code: string, index: number): { code: string; focus: number } {
  if (index < code.length) return { code: code.slice(0, index) + code.slice(index + 1), focus: index };
  const previous = Math.max(0, Math.min(index, code.length) - 1);
  return { code: code.slice(0, previous) + code.slice(previous + 1), focus: previous };
}
