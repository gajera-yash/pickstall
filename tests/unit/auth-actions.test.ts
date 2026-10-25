import { beforeEach, describe, expect, it, vi } from "vitest";

import { formData, redirectOf, supabase } from "./auth-mocks";

import { sendEmailCode, signInWithGoogle, verifyEmailCode } from "@/lib/auth/actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendEmailCode", () => {
  it("rejects an invalid email without calling Supabase", async () => {
    const result = await sendEmailCode(null, formData({ email: "not-an-email" }));
    expect(result).toEqual({ ok: false, error: "Enter a valid email address." });
    expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends a code to the normalized email", async () => {
    supabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    const result = await sendEmailCode(null, formData({ email: " Maya@Example.com " }));
    expect(result).toEqual({ ok: true, data: { email: "maya@example.com" } });
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "maya@example.com",
      options: { shouldCreateUser: true },
    });
  });

  it("explains rate limits plainly", async () => {
    supabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: { status: 429, code: "over_email_send_rate_limit" } });
    const result = await sendEmailCode(null, formData({ email: "maya@example.com" }));
    expect(result).toEqual({ ok: false, error: "Too many attempts. Wait a minute, then try again." });
  });

  it("does not leak provider error details", async () => {
    supabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: { status: 500, code: "unexpected_failure", message: "db down" } });
    const result = await sendEmailCode(null, formData({ email: "maya@example.com" }));
    expect(result?.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("db down");
  });
});

describe("verifyEmailCode", () => {
  it("rejects a malformed code without calling Supabase", async () => {
    const result = await verifyEmailCode(null, formData({ email: "maya@example.com", code: "12ab" }));
    expect(result).toEqual({ ok: false, error: "Enter the 6-digit code from the email." });
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("signs in and redirects to the safe next path", async () => {
    supabase.auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    const url = await redirectOf(() =>
      verifyEmailCode(null, formData({ email: "maya@example.com", code: "123 456", next: "/library" })),
    );
    expect(url).toBe("/library");
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ email: "maya@example.com", token: "123456", type: "email" });
  });

  it("never redirects off-site", async () => {
    supabase.auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    const url = await redirectOf(() =>
      verifyEmailCode(null, formData({ email: "maya@example.com", code: "123456", next: "https://evil.test" })),
    );
    expect(url).toBe("/");
  });

  it("returns a plain error for a wrong or expired code", async () => {
    supabase.auth.verifyOtp.mockResolvedValue({ data: {}, error: { status: 403, code: "otp_expired" } });
    const result = await verifyEmailCode(null, formData({ email: "maya@example.com", code: "123456" }));
    expect(result).toEqual({
      ok: false,
      error: "That code is wrong or has expired. Check the email or request a new code.",
    });
  });
});

describe("signInWithGoogle", () => {
  it("sends Google back to our callback with a safe next path", async () => {
    supabase.auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.example.test/o" }, error: null });
    const url = await redirectOf(() => signInWithGoogle(formData({ next: "//evil.test" })));
    expect(url).toBe("https://accounts.example.test/o");
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost:3000/auth/callback?next=%2F" },
    });
  });

  it("falls back to the login page if Google cannot start", async () => {
    supabase.auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { status: 400, code: "provider_disabled" } });
    expect(await redirectOf(() => signInWithGoogle(formData({})))).toBe("/login?error=google");
  });
});
