import { describe, expect, it } from "vitest";

import { SIGNUP_STEPS, stepPosition } from "@/lib/signup-steps";

describe("signup steps", () => {
  it("lists the steps in order and ends with the activation moment", () => {
    expect([...SIGNUP_STEPS]).toEqual(["account", "verify", "store", "activate"]);
  });

  it("gives each step a 1-based position out of the total", () => {
    expect(stepPosition("account")).toEqual({ current: 1, total: 4 });
    expect(stepPosition("verify")).toEqual({ current: 2, total: 4 });
    expect(stepPosition("store")).toEqual({ current: 3, total: 4 });
    expect(stepPosition("activate")).toEqual({ current: 4, total: 4 });
  });
});
