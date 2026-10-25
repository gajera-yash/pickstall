import { beforeEach, describe, expect, it, vi } from "vitest";

import { formData, mockSlugLookup, mockStoreQuery, redirectOf, supabase } from "./auth-mocks";

import { sendEmailCode, signInWithGoogle, startSignup, verifyEmailCode } from "@/lib/auth/actions";

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
    supabase.auth.verifyOtp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const url = await redirectOf(() =>
      verifyEmailCode(null, formData({ email: "maya@example.com", code: "123 456", next: "/library" })),
    );
    expect(url).toBe("/library");
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ email: "maya@example.com", token: "123456", type: "email" });
  });

  it("never redirects off-site", async () => {
    supabase.auth.verifyOtp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockStoreQuery({ data: null, error: null });
    const url = await redirectOf(() =>
      verifyEmailCode(null, formData({ email: "maya@example.com", code: "123456", next: "https://evil.test" })),
    );
    expect(url).toBe("/onboarding");
  });

  it("sends a creator with a store to the dashboard when there is no next path", async () => {
    supabase.auth.verifyOtp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockStoreQuery({ data: { id: "store-1" }, error: null });
    const url = await redirectOf(() => verifyEmailCode(null, formData({ email: "maya@example.com", code: "123456" })));
    expect(url).toBe("/dashboard");
  });

  it("sends a user without a store to onboarding when there is no next path", async () => {
    supabase.auth.verifyOtp.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockStoreQuery({ data: null, error: null });
    const url = await redirectOf(() => verifyEmailCode(null, formData({ email: "maya@example.com", code: "123456" })));
    expect(url).toBe("/onboarding");
  });

  it("does not look up a store when the code is wrong", async () => {
    supabase.auth.verifyOtp.mockResolvedValue({ data: { user: null }, error: { status: 403, code: "otp_expired" } });
    await verifyEmailCode(null, formData({ email: "maya@example.com", code: "123456" }));
    expect(supabase.from).not.toHaveBeenCalled();
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

describe("startSignup", () => {
  const form = (overrides: Record<string, string> = {}) =>
    formData({
      username: "Maya-Books",
      fullName: "Maya Patel",
      email: "Maya@Example.com",
      phone: "+1 415 555 0100",
      ...overrides,
    });

  it("rejects bad input with the field name, before any lookup or email", async () => {
    expect(await startSignup(null, form({ username: "ab" }))).toEqual({
      ok: false,
      error: "Use 3 to 30 characters.",
      field: "username",
    });
    expect(await startSignup(null, form({ email: "nope" }))).toMatchObject({ ok: false, field: "email" });
    expect(await startSignup(null, form({ phone: "415" }))).toMatchObject({ ok: false, field: "phone" });
    expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("says the username is taken, without sending a code", async () => {
    mockSlugLookup({ data: { id: "store-1" }, error: null });
    expect(await startSignup(null, form())).toEqual({
      ok: false,
      error: "That username is taken. Try another.",
      field: "username",
    });
    expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("does not send a code when the username check fails", async () => {
    mockSlugLookup({ data: null, error: { code: "PGRST000" } });
    expect(await startSignup(null, form())).toMatchObject({ ok: false, field: "username" });
    expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends a code and passes the cleaned details as metadata", async () => {
    const lookup = mockSlugLookup({ data: null, error: null });
    supabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    expect(await startSignup(null, form())).toEqual({ ok: true, data: { email: "maya@example.com" } });
    expect(lookup.eq).toHaveBeenCalledWith("slug", "maya-books");
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "maya@example.com",
      options: {
        shouldCreateUser: true,
        data: { full_name: "Maya Patel", requested_slug: "maya-books", phone: "+14155550100" },
      },
    });
  });

  it("leaves the phone out of the metadata when it is empty", async () => {
    mockSlugLookup({ data: null, error: null });
    supabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await startSignup(null, form({ phone: "" }));
    const call = supabase.auth.signInWithOtp.mock.calls[0]?.[0] as { options: { data: Record<string, unknown> } };
    expect(call.options.data).toEqual({ full_name: "Maya Patel", requested_slug: "maya-books" });
  });

  it("explains rate limits plainly and hides provider details", async () => {
    mockSlugLookup({ data: null, error: null });
    supabase.auth.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: { status: 429, code: "over_email_send_rate_limit" },
    });
    expect(await startSignup(null, form())).toEqual({
      ok: false,
      error: "Too many attempts. Wait a minute, then try again.",
    });
    supabase.auth.signInWithOtp.mockResolvedValueOnce({
      data: {},
      error: { status: 500, code: "x", message: "db down" },
    });
    expect(JSON.stringify(await startSignup(null, form()))).not.toContain("db down");
  });
});
