import { beforeEach, describe, expect, it, vi } from "vitest";

// The sign-in code email (D-091): sent with the Resend "verification-code" template; if Resend
// refuses the template, the same code goes out as a plain email so nobody is locked out.

const resend = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resend.send };
  },
}));
vi.mock("@/lib/env.server", () => ({ serverEnv: { RESEND_API_KEY: "re_test", EMAIL_FROM: "Pickstall <hello@example.test>" } }));
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { SIGN_IN_TEMPLATE, sendSignInCode } from "@/lib/email/send-sign-in-code";

beforeEach(() => vi.clearAllMocks());

describe("sendSignInCode", () => {
  it("sends the code with the Resend template", async () => {
    resend.send.mockResolvedValueOnce({ data: { id: "e1" }, error: null });
    await sendSignInCode("maya@example.com", "123456");
    expect(resend.send).toHaveBeenCalledTimes(1);
    expect(resend.send.mock.calls[0]?.[0]).toMatchObject({
      to: "maya@example.com",
      from: "Pickstall <hello@example.test>",
      template: { id: "verification-code", variables: { [SIGN_IN_TEMPLATE.codeVariable]: "123456" } },
    });
    expect(resend.send.mock.calls[0]?.[0]).not.toHaveProperty("text");
  });

  it("falls back to a plain email when the template is refused", async () => {
    resend.send.mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: "Template not found" } });
    resend.send.mockResolvedValueOnce({ data: { id: "e2" }, error: null });
    await sendSignInCode("maya@example.com", "654321");
    expect(resend.send).toHaveBeenCalledTimes(2);
    expect(resend.send.mock.calls[1]?.[0]).toMatchObject({ to: "maya@example.com", text: expect.stringContaining("654321") });
  });

  it("fails when even the plain email cannot be sent", async () => {
    resend.send.mockResolvedValue({ data: null, error: { name: "application_error", message: "down" } });
    await expect(sendSignInCode("maya@example.com", "111111")).rejects.toThrow("Could not send the sign-in code.");
  });
});
