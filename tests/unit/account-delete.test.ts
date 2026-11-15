import { beforeEach, describe, expect, it } from "vitest";

import { authApi, FakeAPIError, formData, mockSession, rateLimit, redirectOf, userId } from "./auth-mocks";

// Delete account (D-074): DELETE must be typed, the request is rate-limited, and Better Auth's own
// checks (fresh session) and our cleanup errors reach the person as plain words.

import { deleteAccount } from "@/lib/account/actions";
import { legalPlaceholders } from "@/lib/legal";

beforeEach(() => {
  authApi.deleteUser.mockReset();
  mockSession({ id: userId, email: "maya@example.com" });
  rateLimit.takeRateLimit.mockResolvedValue(true);
});

describe("deleteAccount", () => {
  it("does nothing until DELETE is typed exactly", async () => {
    expect(await deleteAccount(null, formData({ confirm: "delete" }))).toMatchObject({ ok: false, field: "confirm" });
    expect(authApi.deleteUser).not.toHaveBeenCalled();
  });

  it("asks Better Auth to delete the signed-in user, then shows the goodbye page", async () => {
    authApi.deleteUser.mockResolvedValue({ success: true });
    expect(await redirectOf(() => deleteAccount(null, formData({ confirm: "DELETE" })))).toBe("/account/deleted");
    expect(authApi.deleteUser).toHaveBeenCalledWith(expect.objectContaining({ body: {} }));
  });

  it("asks to sign in again when the session is older than a day", async () => {
    authApi.deleteUser.mockRejectedValue(Object.assign(new FakeAPIError(400), { message: "Session expired. Re-authenticate to perform this action." }));
    expect(await deleteAccount(null, formData({ confirm: "DELETE" }))).toMatchObject({ ok: false, error: expect.stringMatching(/sign in again/) });
  });

  it("passes on why the cleanup stopped the deletion (for example Stripe was down)", async () => {
    authApi.deleteUser.mockRejectedValue(Object.assign(new FakeAPIError(400), { message: "We couldn't cancel your plan with Stripe, so your account was not deleted." }));
    expect(await deleteAccount(null, formData({ confirm: "DELETE" }))).toMatchObject({ ok: false, error: expect.stringMatching(/couldn't cancel your plan/) });
  });

  it("is rate-limited", async () => {
    rateLimit.takeRateLimit.mockResolvedValueOnce(false);
    expect(await deleteAccount(null, formData({ confirm: "DELETE" }))).toMatchObject({ ok: false, error: expect.stringMatching(/Too many/) });
    expect(authApi.deleteUser).not.toHaveBeenCalled();
  });

  it("hides unexpected errors", async () => {
    authApi.deleteUser.mockRejectedValue(new Error("db down"));
    expect(await deleteAccount(null, formData({ confirm: "DELETE" }))).toEqual({ ok: false, error: "Your account could not be deleted. Please try again." });
  });
});

describe("legalPlaceholders (D-074)", () => {
  it("lists the operator details still to fill in, nested ones included", () => {
    expect(legalPlaceholders({ operatorName: "[YOUR NAME]", city: "Surat", officer: { name: "[OFFICER NAME]", email: "a@b.co" } })).toEqual(["operatorName", "officer.name"]);
    expect(legalPlaceholders({ operatorName: "Asha Shah", city: "Surat" })).toEqual([]);
  });
});
