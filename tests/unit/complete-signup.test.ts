import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cookieJar, draftStore, intents, redirectOf, supabase } from "./auth-mocks";

import { claimUsername } from "@/lib/auth/actions";
import { completeSignup } from "@/lib/auth/complete-signup";

const client = supabase as unknown as SupabaseClient;
const user = { id: "11111111-1111-4111-8111-111111111111", email: "maya@example.com" };
const intent = { email: "maya@example.com", username: "maya-books", fullName: "Maya Patel", phone: "+14155550100" };

/** Routes supabase.from(table) to small fake query chains. */
function mockTables(opts: { store?: unknown; profile?: { full_name: string | null } | null } = {}) {
  const profileUpdate = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  supabase.from.mockImplementation((table: string) => {
    if (table === "stores") {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.store ?? null, error: null }) }) }) };
    }
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.profile ?? null, error: null }) }) }),
      update: profileUpdate,
    };
  });
  return { profileUpdate };
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.clear();
});

describe("completeSignup", () => {
  it("uses the normal rules when this browser has no signup cookie", async () => {
    mockTables({ store: null });
    expect(await completeSignup(client, user, undefined)).toBe("/signup/username");
    expect(intents.takeSignupIntent).not.toHaveBeenCalled();
  });

  it("applies the intent: profile, then the draft store, then the dashboard", async () => {
    cookieJar.set("signup_intent", "cookie-value");
    intents.takeSignupIntent.mockResolvedValue(intent);
    draftStore.createDraftStore.mockResolvedValue("created");
    const { profileUpdate } = mockTables({ store: null });

    expect(await completeSignup(client, user, undefined)).toBe("/dashboard");
    expect(intents.takeSignupIntent).toHaveBeenCalledWith("maya@example.com", "cookie-value");
    expect(profileUpdate).toHaveBeenCalledWith({ full_name: "Maya Patel", phone: "+14155550100" });
    expect(draftStore.createDraftStore).toHaveBeenCalledWith(client, user.id, "maya-books", "Maya Patel");
    expect(cookieJar.has("signup_intent")).toBe(false);
  });

  it("ignores an intent that does not belong to this browser or email", async () => {
    cookieJar.set("signup_intent", "someone-elses-cookie");
    intents.takeSignupIntent.mockResolvedValue(null);
    mockTables({ store: { id: "store-1" } });

    expect(await completeSignup(client, user, undefined)).toBe("/dashboard");
    expect(draftStore.createDraftStore).not.toHaveBeenCalled();
    expect(cookieJar.has("signup_intent")).toBe(false);
  });

  it("keeps the session and asks for another username when it was taken meanwhile", async () => {
    cookieJar.set("signup_intent", "cookie-value");
    intents.takeSignupIntent.mockResolvedValue(intent);
    draftStore.createDraftStore.mockResolvedValue("taken");
    mockTables({ store: null });

    expect(await completeSignup(client, user, undefined)).toBe("/signup/username?taken=1");
  });

  it("does not touch an existing creator's store or profile", async () => {
    cookieJar.set("signup_intent", "cookie-value");
    intents.takeSignupIntent.mockResolvedValue(intent);
    const { profileUpdate } = mockTables({ store: { id: "store-1" } });

    expect(await completeSignup(client, user, undefined)).toBe("/dashboard");
    expect(profileUpdate).not.toHaveBeenCalled();
    expect(draftStore.createDraftStore).not.toHaveBeenCalled();
  });

  it("leaves the phone out of the profile update when there is none", async () => {
    cookieJar.set("signup_intent", "cookie-value");
    intents.takeSignupIntent.mockResolvedValue({ ...intent, phone: null });
    draftStore.createDraftStore.mockResolvedValue("created");
    const { profileUpdate } = mockTables({ store: null });

    await completeSignup(client, user, undefined);
    expect(profileUpdate).toHaveBeenCalledWith({ full_name: "Maya Patel" });
  });
});

describe("claimUsername", () => {
  const claims = { sub: user.id, email: user.email };
  const form = (values: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return data;
  };

  beforeEach(() => {
    supabase.auth.getClaims.mockResolvedValue({ data: { claims }, error: null });
  });

  it("sends a signed-out visitor to login", async () => {
    supabase.auth.getClaims.mockResolvedValue({ data: null, error: null });
    expect(await redirectOf(() => claimUsername(null, form({ username: "maya" })))).toBe("/login?next=%2Fsignup%2Fusername");
  });

  it("validates the username and phone before touching the database", async () => {
    mockTables({ profile: { full_name: "Maya" } });
    expect(await claimUsername(null, form({ username: "ab" }))).toMatchObject({ ok: false, field: "username" });
    expect(await claimUsername(null, form({ username: "maya", phone: "415" }))).toMatchObject({ ok: false, field: "phone" });
    expect(draftStore.createDraftStore).not.toHaveBeenCalled();
  });

  it("asks for a full name when the profile has none (for example email login)", async () => {
    mockTables({ profile: { full_name: null } });
    expect(await claimUsername(null, form({ username: "maya" }))).toEqual({
      ok: false,
      error: "Enter your full name.",
      field: "fullName",
    });
  });

  it("creates the draft store with the profile name and goes to the dashboard", async () => {
    mockTables({ profile: { full_name: "Maya Patel" } });
    draftStore.createDraftStore.mockResolvedValue("created");
    expect(await redirectOf(() => claimUsername(null, form({ username: "Maya-Books" })))).toBe("/dashboard");
    expect(draftStore.createDraftStore).toHaveBeenCalledWith(client, user.id, "maya-books", "Maya Patel");
  });

  it("saves a new name and phone with the user's own session", async () => {
    const { profileUpdate } = mockTables({ profile: { full_name: null } });
    draftStore.createDraftStore.mockResolvedValue("created");
    await redirectOf(() => claimUsername(null, form({ username: "maya", fullName: "Maya P", phone: "+1 415 555 0100" })));
    expect(profileUpdate).toHaveBeenCalledWith({ full_name: "Maya P", phone: "+14155550100" });
  });

  it("reports a taken username on the field", async () => {
    mockTables({ profile: { full_name: "Maya" } });
    draftStore.createDraftStore.mockResolvedValue("taken");
    expect(await claimUsername(null, form({ username: "maya" }))).toEqual({
      ok: false,
      error: "That username is taken. Try another.",
      field: "username",
    });
  });

  it("goes to the dashboard when the user already has a store", async () => {
    mockTables({ profile: { full_name: "Maya" } });
    draftStore.createDraftStore.mockResolvedValue("has_store");
    expect(await redirectOf(() => claimUsername(null, form({ username: "maya" })))).toBe("/dashboard");
  });
});
