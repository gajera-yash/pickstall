import { describe, expect, it } from "vitest";

import { normalizeCodeInput, secondsRemaining } from "@/lib/auth/code";
import { emailCodeSchema } from "@/lib/auth/schemas";
import { OTP_LENGTH, OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/config";

describe("normalizeCodeInput", () => {
  it.each([
    ["123456", "123456"],
    ["123 456", "123456"],
    ["123-456", "123456"],
    [" 12a3b4c5d6 ", "123456"],
    ["12345678", "123456"],
    ["abc", ""],
    ["", ""],
  ])("turns %j into %j", (input, expected) => {
    expect(normalizeCodeInput(input)).toBe(expected);
  });

  it("produces something the server schema accepts once six digits are in", () => {
    expect(emailCodeSchema.safeParse(normalizeCodeInput("123 456")).success).toBe(true);
    expect(emailCodeSchema.safeParse(normalizeCodeInput("123 45")).success).toBe(false);
  });

  it("uses the configured code length", () => {
    expect(OTP_LENGTH).toBe(6);
  });
});

describe("secondsRemaining (resend cooldown)", () => {
  const start = 1_000_000;
  const end = start + OTP_RESEND_COOLDOWN_SECONDS * 1000;

  it("starts at the full cooldown", () => {
    expect(OTP_RESEND_COOLDOWN_SECONDS).toBe(30);
    expect(secondsRemaining(end, start)).toBe(30);
  });

  it("counts down and rounds partial seconds up", () => {
    expect(secondsRemaining(end, start + 1)).toBe(30);
    expect(secondsRemaining(end, start + 1000)).toBe(29);
    expect(secondsRemaining(end, start + 29_001)).toBe(1);
  });

  it("is 0 when the cooldown is over, or was never started", () => {
    expect(secondsRemaining(end, end)).toBe(0);
    expect(secondsRemaining(end, end + 5000)).toBe(0);
    expect(secondsRemaining(0, 0)).toBe(0);
  });
});
