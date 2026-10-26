import { describe, expect, it } from "vitest";

import { SIGNUP_STEPS, stepPosition } from "@/lib/signup-steps";

describe("signup steps (D-008)", () => {
  it("has two steps: details, then the email code", () => {
    expect([...SIGNUP_STEPS]).toEqual(["details", "code"]);
  });

  it("gives each step a 1-based position out of 2", () => {
    expect(stepPosition("details")).toEqual({ current: 1, total: 2 });
    expect(stepPosition("code")).toEqual({ current: 2, total: 2 });
  });
});
