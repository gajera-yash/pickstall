import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeAPIError, accounts, authApi, cookieJar, formData, intents, rateLimit, redirectOf, slugs, storeQueries } from "./auth-mocks";

import { sendEmailCode, signInWithGoogle, startSignup, verifyEmailCode } from "@/lib/auth/actions";

const signedIn = { token: "t", user: { id: "user-1", email: "maya@example.com" } };

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.clear();
  rateLimit.takeRateLimit.mockResolvedValue(true);
  storeQueries.findStoreByOwner.mockResolvedValue(null);
});

describe("sendEmailCode", () => {
  it("rejects an invalid email without sending anything", async () => {
    const result = await sendEmailCode(null, formData({ email: "not-an-email" }));
    expect(result).toEqual({ ok: false, error: "Enter a valid email address." });
    expect(authApi.sendVerificationOTP).not.toHaveBeenCalled();
  });

  it("sends a sign-in code to the normalized email", async () => {
    authApi.sendVerificationOTP.mockResolvedValue({ success: true });
    const result = await sendEmailCode(null, formData({ email: " Maya@Example.com " }));
    expect(result).toEqual({ ok: true, data: { email: "maya@example.com" } });
    expect(authApi.sendVerificationOTP).toHaveBeenCalledWith({ body: { email: "maya@example.com", type: "sign-in" } });
    expect(rateLimit.takeRateLimit).toHaveBeenCalledWith("send-code:email:maya@example.com", 5, 15);
  });

  it("stops at our own rate limit without sending", async () => {
    rateLimit.takeRateLimit.mockResolvedValue(false);
    const result = await sendEmailCode(null, formData({ email: "maya@example.com" }));
    expect(result).toEqual({ ok: false, error: "Too many attempts. Wait a minute, then try again." });
    expect(authApi.sendVerificationOTP).not.toHaveBeenCalled();
  });

  it("explains provider rate limits plainly", async () => {
    authApi.sendVerificationOTP.mockRejectedValue(new FakeAPIError(429));
    const result = await sendEmailCode(null, formData({ email: "maya@example.com" }));
    expect(result).toEqual({ ok: false, error: "Too many attempts. Wait a minute, then try again." });
  });

  it("does not leak error details", async () => {
    authApi.sendVerificationOTP.mockRejectedValue(new Error("db down"));
    const result = await sendEmailCode(null, formData({ email: "maya@example.com" }));
    expect(result?.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("db down");
  });
});

describe("verifyEmailCode", () => {
  it("rejects a malformed code without checking it", async () => {
    const result = await verifyEmailCode(null, formData({ email: "maya@example.com", code: "12ab" }));
    expect(result).toEqual({ ok: false, error: "Enter the 6-digit code from the email." });
    expect(authApi.signInEmailOTP).not.toHaveBeenCalled();
  });

  it("signs in and redirects to the safe next path", async () => {
    authApi.signInEmailOTP.mockResolvedValue(signedIn);
    const url = await redirectOf(() =>
      verifyEmailCode(null, formData({ email: "maya@example.com", code: "123 456", next: "/library" })),
    );
    expect(url).toBe("/library");
    expect(authApi.signInEmailOTP).toHaveBeenCalledWith(
      expect.objectContaining({ body: { email: "maya@example.com", otp: "123456" } }),
    );
  });

  it("never redirects off-site", async () => {
    authApi.signInEmailOTP.mockResolvedValue(signedIn);
    const url = await redirectOf(() =>
      verifyEmailCode(null, formData({ email: "maya@example.com", code: "123456", next: "https://evil.test" })),
    );
    expect(url).toBe("/signup/username");
  });

  it("sends a creator with a store to the dashboard when there is no next path", async () => {
    authApi.signInEmailOTP.mockResolvedValue(signedIn);
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "store-1" });
    const url = await redirectOf(() => verifyEmailCode(null, formData({ email: "maya@example.com", code: "123456" })));
    expect(url).toBe("/dashboard");
    expect(storeQueries.findStoreByOwner).toHaveBeenCalledWith("user-1");
  });

  it("does not look up a store when the code is wrong", async () => {
    authApi.signInEmailOTP.mockRejectedValue(new FakeAPIError(400, "INVALID_OTP"));
    await verifyEmailCode(null, formData({ email: "maya@example.com", code: "123456" }));
    expect(storeQueries.findStoreByOwner).not.toHaveBeenCalled();
  });

  it("returns a plain error for a wrong or expired code", async () => {
    authApi.signInEmailOTP.mockRejectedValue(new FakeAPIError(400, "OTP_EXPIRED"));
    const result = await verifyEmailCode(null, formData({ email: "maya@example.com", code: "123456" }));
    expect(result).toEqual({
      ok: false,
      error: "That code is wrong or has expired. Check the email or request a new code.",
    });
  });
});

describe("signInWithGoogle", () => {
  it("sends Google back to our callback with a safe next path", async () => {
    authApi.signInSocial.mockResolvedValue({ url: "https://accounts.example.test/o", redirect: true });
    const url = await redirectOf(() => signInWithGoogle(formData({ next: "//evil.test" })));
    expect(url).toBe("https://accounts.example.test/o");
    expect(authApi.signInSocial).toHaveBeenCalledWith({
      body: { provider: "google", callbackURL: "/auth/callback?next=%2F", errorCallbackURL: "/login?error=google" },
    });
  });

  it("falls back to the login page if Google cannot start", async () => {
    authApi.signInSocial.mockRejectedValue(new FakeAPIError(404, "Provider not found"));
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
      acceptTerms: "on",
      ...overrides,
    });
  const cookie = "11111111-1111-4111-8111-111111111111.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  it("rejects bad input with the field name, before any lookup, intent or email", async () => {
    expect(await startSignup(null, form({ username: "ab" }))).toEqual({
      ok: false,
      error: "Use 3 to 30 characters.",
      field: "username",
    });
    expect(await startSignup(null, form({ email: "nope" }))).toMatchObject({ ok: false, field: "email" });
    expect(await startSignup(null, form({ phone: "415" }))).toMatchObject({ ok: false, field: "phone" });
    expect(intents.saveSignupIntent).not.toHaveBeenCalled();
    expect(authApi.sendVerificationOTP).not.toHaveBeenCalled();
  });

  it("needs the Terms box ticked before anything else happens (D-074)", async () => {
    expect(await startSignup(null, form({ acceptTerms: "" }))).toMatchObject({ ok: false, field: "acceptTerms" });
    expect(intents.saveSignupIntent).not.toHaveBeenCalled();
  });

  it("refuses a throwaway inbox before any lookup", async () => {
    expect(await startSignup(null, form({ email: "maya@mailinator.com" }))).toMatchObject({ ok: false, field: "email" });
    expect(accounts.emailHasAccount).not.toHaveBeenCalled();
    expect(intents.saveSignupIntent).not.toHaveBeenCalled();
  });

  it("says the email already has an account (D-071), without saving an intent or sending a code", async () => {
    accounts.emailHasAccount.mockResolvedValueOnce(true);
    expect(await startSignup(null, form())).toEqual({ ok: false, error: "This email already has an account. Log in instead.", field: "email" });
    expect(accounts.emailHasAccount).toHaveBeenCalledWith("maya@example.com");
    expect(intents.saveSignupIntent).not.toHaveBeenCalled();
    expect(authApi.sendVerificationOTP).not.toHaveBeenCalled();
  });

  it("rate-limits the email check per browser and IP", async () => {
    rateLimit.takeRateLimit.mockResolvedValueOnce(false);
    expect(await startSignup(null, form())).toMatchObject({ ok: false, error: expect.stringMatching(/Too many attempts/) });
    expect(accounts.emailHasAccount).not.toHaveBeenCalled();
    expect(rateLimit.takeRateLimit.mock.calls[0]?.[0]).toBe("signup-email-check:device:test-device-id");
  });

  it("says the username is taken, without saving an intent or sending a code", async () => {
    slugs.isSlugTaken.mockResolvedValue({ ok: true, data: true });
    expect(await startSignup(null, form())).toEqual({
      ok: false,
      error: "That username is taken. Try another.",
      field: "username",
    });
    expect(intents.saveSignupIntent).not.toHaveBeenCalled();
    expect(authApi.sendVerificationOTP).not.toHaveBeenCalled();
  });

  it("saves the cleaned details server-side, binds them to this browser and sends a code", async () => {
    slugs.isSlugTaken.mockResolvedValue({ ok: true, data: false });
    intents.saveSignupIntent.mockResolvedValue({ ok: true, data: { cookie } });
    authApi.sendVerificationOTP.mockResolvedValue({ success: true });

    expect(await startSignup(null, form())).toEqual({ ok: true, data: { email: "maya@example.com" } });
    expect(slugs.isSlugTaken).toHaveBeenCalledWith("maya-books");
    expect(intents.saveSignupIntent).toHaveBeenCalledWith(
      { email: "maya@example.com", username: "maya-books", fullName: "Maya Patel", phone: "+14155550100" },
      null,
    );
    expect(cookieJar.get("signup_intent")).toBe(cookie);
    expect(authApi.sendVerificationOTP).toHaveBeenCalledWith({ body: { email: "maya@example.com", type: "sign-in" } });
  });

  it("stores no phone when it is empty", async () => {
    slugs.isSlugTaken.mockResolvedValue({ ok: true, data: false });
    intents.saveSignupIntent.mockResolvedValue({ ok: true, data: { cookie } });
    authApi.sendVerificationOTP.mockResolvedValue({ success: true });
    await startSignup(null, form({ phone: "" }));
    expect(intents.saveSignupIntent.mock.calls[0]?.[0]).toMatchObject({ phone: null });
  });

  it("stops at the signup rate limit without sending a code", async () => {
    slugs.isSlugTaken.mockResolvedValue({ ok: true, data: false });
    intents.saveSignupIntent.mockResolvedValue({
      ok: false,
      error: "Too many sign-up attempts. Wait 15 minutes, then try again.",
    });
    expect(await startSignup(null, form())).toEqual({
      ok: false,
      error: "Too many sign-up attempts. Wait 15 minutes, then try again.",
    });
    expect(authApi.sendVerificationOTP).not.toHaveBeenCalled();
    expect(cookieJar.has("signup_intent")).toBe(false);
  });

  it("explains email rate limits plainly and hides error details", async () => {
    slugs.isSlugTaken.mockResolvedValue({ ok: true, data: false });
    intents.saveSignupIntent.mockResolvedValue({ ok: true, data: { cookie } });
    authApi.sendVerificationOTP.mockRejectedValueOnce(new FakeAPIError(429));
    expect(await startSignup(null, form())).toEqual({
      ok: false,
      error: "Too many attempts. Wait a minute, then try again.",
    });
    authApi.sendVerificationOTP.mockRejectedValueOnce(new Error("db down"));
    expect(JSON.stringify(await startSignup(null, form()))).not.toContain("db down");
  });
});
