import { beforeEach, describe, expect, it, vi } from "vitest";

import { cookieJar, draftStore, formData, intents, mockSession, profiles, redirectOf, storeQueries, userId } from "./auth-mocks";

import { claimUsername } from "@/lib/auth/actions";
import { completeSignup } from "@/lib/auth/complete-signup";

const user = { id: userId, email: "maya@example.com" };
const intent = { email: "maya@example.com", username: "maya-books", fullName: "Maya Patel", phone: "+14155550100" };

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.clear();
  storeQueries.findStoreByOwner.mockResolvedValue(null);
  profiles.saveProfile.mockResolvedValue(undefined);
});

describe("completeSignup", () => {
  it("uses the normal rules when this browser has no signup cookie", async () => {
    expect(await completeSignup(user, undefined)).toBe("/signup/username");
    expect(intents.takeSignupIntent).not.toHaveBeenCalled();
  });

  it("applies the intent: profile, then the draft store, then the dashboard", async () => {
    cookieJar.set("signup_intent", "cookie-value");
    intents.takeSignupIntent.mockResolvedValue(intent);
    draftStore.createDraftStore.mockResolvedValue("created");

    expect(await completeSignup(user, undefined)).toBe("/dashboard");
    expect(intents.takeSignupIntent).toHaveBeenCalledWith("maya@example.com", "cookie-value");
    expect(profiles.saveProfile).toHaveBeenCalledWith(userId, "maya@example.com", { fullName: "Maya Patel", phone: "+14155550100" });
    expect(draftStore.createDraftStore).toHaveBeenCalledWith(userId, "maya-books");
    expect(cookieJar.has("signup_intent")).toBe(false);
  });

  it("ignores an intent that does not belong to this browser or email", async () => {
    cookieJar.set("signup_intent", "someone-elses-cookie");
    intents.takeSignupIntent.mockResolvedValue(null);
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "store-1" });

    expect(await completeSignup(user, undefined)).toBe("/dashboard");
    expect(draftStore.createDraftStore).not.toHaveBeenCalled();
    expect(cookieJar.has("signup_intent")).toBe(false);
  });

  it("keeps the session and asks for another username when it was taken meanwhile", async () => {
    cookieJar.set("signup_intent", "cookie-value");
    intents.takeSignupIntent.mockResolvedValue(intent);
    draftStore.createDraftStore.mockResolvedValue("taken");

    expect(await completeSignup(user, undefined)).toBe("/signup/username?taken=1");
  });

  it("does not touch an existing creator's store or profile", async () => {
    cookieJar.set("signup_intent", "cookie-value");
    intents.takeSignupIntent.mockResolvedValue(intent);
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "store-1" });

    expect(await completeSignup(user, undefined)).toBe("/dashboard");
    expect(profiles.saveProfile).not.toHaveBeenCalled();
    expect(draftStore.createDraftStore).not.toHaveBeenCalled();
  });

  it("leaves the phone out of the profile when there is none", async () => {
    cookieJar.set("signup_intent", "cookie-value");
    intents.takeSignupIntent.mockResolvedValue({ ...intent, phone: null });
    draftStore.createDraftStore.mockResolvedValue("created");

    await completeSignup(user, undefined);
    expect(profiles.saveProfile).toHaveBeenCalledWith(userId, "maya@example.com", { fullName: "Maya Patel" });
  });
});

describe("claimUsername", () => {
  beforeEach(() => {
    mockSession(user);
  });

  it("sends a signed-out visitor to login", async () => {
    mockSession(null);
    expect(await redirectOf(() => claimUsername(null, formData({ username: "maya" })))).toBe("/login?next=%2Fsignup%2Fusername");
  });

  it("validates the username and phone before touching the database", async () => {
    expect(await claimUsername(null, formData({ username: "ab" }))).toMatchObject({ ok: false, field: "username" });
    expect(await claimUsername(null, formData({ username: "maya", phone: "415" }))).toMatchObject({ ok: false, field: "phone" });
    expect(profiles.getProfile).not.toHaveBeenCalled();
    expect(draftStore.createDraftStore).not.toHaveBeenCalled();
  });

  it("asks for a full name when the profile has none (for example email login)", async () => {
    profiles.getProfile.mockResolvedValue({ fullName: null, phone: null });
    expect(await claimUsername(null, formData({ username: "maya" }))).toEqual({
      ok: false,
      error: "Enter your full name.",
      field: "fullName",
    });
  });

  it("creates the draft store for the session user with the profile name", async () => {
    profiles.getProfile.mockResolvedValue({ fullName: "Maya Patel", phone: null });
    draftStore.createDraftStore.mockResolvedValue("created");
    expect(await redirectOf(() => claimUsername(null, formData({ username: "Maya-Books" })))).toBe("/dashboard");
    expect(draftStore.createDraftStore).toHaveBeenCalledWith(userId, "maya-books");
  });

  it("saves a new name and phone", async () => {
    profiles.getProfile.mockResolvedValue(null);
    draftStore.createDraftStore.mockResolvedValue("created");
    await redirectOf(() => claimUsername(null, formData({ username: "maya", fullName: "Maya P", phone: "+1 415 555 0100" })));
    expect(profiles.saveProfile).toHaveBeenCalledWith(userId, "maya@example.com", { fullName: "Maya P", phone: "+14155550100" });
  });

  it("reports a taken username on the field", async () => {
    profiles.getProfile.mockResolvedValue({ fullName: "Maya", phone: null });
    draftStore.createDraftStore.mockResolvedValue("taken");
    expect(await claimUsername(null, formData({ username: "maya" }))).toEqual({
      ok: false,
      error: "That username is taken. Try another.",
      field: "username",
    });
  });

  it("goes to the dashboard when the user already has a store", async () => {
    profiles.getProfile.mockResolvedValue({ fullName: "Maya", phone: null });
    draftStore.createDraftStore.mockResolvedValue("has_store");
    expect(await redirectOf(() => claimUsername(null, formData({ username: "maya" })))).toBe("/dashboard");
  });
});
