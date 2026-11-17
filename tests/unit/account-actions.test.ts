import { beforeEach, describe, expect, it, vi } from "vitest";

import { audit, authApi, formData, mockSession, profiles, rateLimit, redirectOf, storeQueries, userId } from "./auth-mocks";

import { saveAccount, signOutOtherDevices } from "@/lib/account/actions";

describe("saveAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "store-1", slug: "maya" });
    profiles.saveProfile.mockResolvedValue(undefined);
  });

  it("saves name and phone on the session user's own profile, with the session email", async () => {
    const result = await saveAccount(null, formData({ fullName: " Maya Patel ", phone: "+91 98765 43210", userId: "someone-else", email: "x@evil.test" }));
    expect(result?.ok).toBe(true);
    expect(profiles.saveProfile).toHaveBeenCalledWith(userId, "maya@example.com", { fullName: "Maya Patel", phone: "+919876543210" });
  });

  it("clears the phone when the field is empty", async () => {
    await saveAccount(null, formData({ fullName: "Maya", phone: "" }));
    expect(profiles.saveProfile).toHaveBeenCalledWith(userId, "maya@example.com", { fullName: "Maya", phone: null });
  });

  it("returns the field with the problem, without saving", async () => {
    expect(await saveAccount(null, formData({ fullName: "", phone: "" }))).toMatchObject({ ok: false, field: "fullName" });
    expect(await saveAccount(null, formData({ fullName: "Maya", phone: "+1 123" }))).toMatchObject({ ok: false, field: "phone" });
    expect(profiles.saveProfile).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to login", async () => {
    mockSession(null);
    expect(await redirectOf(() => saveAccount(null, formData({ fullName: "Maya" })))).toBe("/login?next=%2Fdashboard%2Fsettings%2Faccount");
  });

  it("hides database errors", async () => {
    profiles.saveProfile.mockRejectedValue(new Error("db down"));
    expect(await saveAccount(null, formData({ fullName: "Maya", phone: "" }))).toEqual({
      ok: false,
      error: "Couldn't save your account. Check your connection and try again.",
    });
  });
});

describe("signOutOtherDevices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    authApi.revokeOtherSessions.mockResolvedValue({ status: true });
    rateLimit.takeRateLimit.mockResolvedValue(true);
  });

  it("ends the other sessions of the signed-in person and records it", async () => {
    expect(await signOutOtherDevices()).toMatchObject({ ok: true });
    expect(authApi.revokeOtherSessions).toHaveBeenCalledTimes(1);
    expect(audit.recordAudit).toHaveBeenCalledWith({ actorId: userId, action: "security.signed_out_other_devices" });
  });

  it("sends a signed-out visitor to login", async () => {
    mockSession(null);
    expect(await redirectOf(() => signOutOtherDevices())).toBe("/login?next=%2Faccount");
    expect(authApi.revokeOtherSessions).not.toHaveBeenCalled();
  });

  it("hides Better Auth errors and records nothing", async () => {
    authApi.revokeOtherSessions.mockRejectedValue(new Error("adapter detail"));
    expect(await signOutOtherDevices()).toEqual({ ok: false, error: "Couldn't sign out your other devices. Please try again." });
    expect(audit.recordAudit).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    rateLimit.takeRateLimit.mockResolvedValueOnce(false);
    expect(await signOutOtherDevices()).toMatchObject({ ok: false });
    expect(authApi.revokeOtherSessions).not.toHaveBeenCalled();
  });
});
