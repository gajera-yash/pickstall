import { OTP_LENGTH } from "@/lib/config";

/** Keeps digits only and caps the length, so pasting "123 456" or "123-456" works. */
export function normalizeCodeInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

/** Whole seconds left until `endsAtMs` (rounded up), never below 0. Used for the resend cooldown. */
export function secondsRemaining(endsAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
}
