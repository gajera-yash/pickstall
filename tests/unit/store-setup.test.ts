import { beforeEach, describe, expect, it, vi } from "vitest";

import { formData, mockSession, rateLimit, redirectOf, storeQueries, userId } from "./auth-mocks";

import { changeUsername, savePageDesign, saveStoreSetup } from "@/lib/stores/actions";
import { pageDesignInput, socialLinkRowsFromForm, storeProfileInput } from "@/lib/stores/schemas";
import { onAccentFor } from "@/lib/themes";

const profile = {
  name: "Maya's Kitchen",
  bio: "Quick dinners.",
  avatarUrl: "https://images.example.com/maya.jpg",
  currency: "gbp",
  socialLinks: [{ kind: "youtube", url: "https://youtube.com/@maya" }],
};

function profileForm(values: Record<string, string>, links: [string, string][] = [["youtube", "https://youtube.com/@maya"]]): FormData {
  const form = formData(values);
  for (const [kind, url] of links) {
    form.append("socialKind", kind);
    form.append("socialUrl", url);
  }
  return form;
}

const profileFields = { name: profile.name, bio: profile.bio, avatarUrl: profile.avatarUrl, currency: profile.currency };

describe("storeProfileInput", () => {
  it("accepts a complete profile", () => {
    expect(storeProfileInput.parse(profile)).toEqual(profile);
  });

  it("turns empty optional fields into undefined", () => {
    expect(storeProfileInput.parse({ ...profile, bio: " ", avatarUrl: "" })).toMatchObject({ bio: undefined, avatarUrl: undefined });
  });

  it.each([
    ["javascript image", { avatarUrl: "javascript:alert(1)" }],
    ["data image", { avatarUrl: "data:image/png;base64,AAAA" }],
    ["unknown currency", { currency: "inr" }],
    ["control characters in the name", { name: "Maya\u0000" }],
    ["a too-long bio", { bio: "x".repeat(201) }],
    ["an http social link", { socialLinks: [{ kind: "website", url: "http://example.com" }] }],
    ["a javascript social link", { socialLinks: [{ kind: "website", url: "javascript:alert(1)" }] }],
    ["credentials in a social link", { socialLinks: [{ kind: "website", url: "https://user:pass@example.com" }] }],
    ["an unknown social kind", { socialLinks: [{ kind: "myspace", url: "https://myspace.com/maya" }] }],
    ["an empty social link", { socialLinks: [{ kind: "website", url: "" }] }],
    ["the same link twice", { socialLinks: [{ kind: "website", url: "https://a.com" }, { kind: "x", url: "https://A.com" }] }],
    ["more than 6 links", { socialLinks: Array.from({ length: 7 }, (_, i) => ({ kind: "website", url: `https://site${i}.com` })) }],
  ])("rejects %s", (_label, override) => {
    expect(storeProfileInput.safeParse({ ...profile, ...override }).success).toBe(false);
  });
});

describe("pageDesignInput", () => {
  it("accepts a preset and normalizes the accent", () => {
    expect(pageDesignInput.parse({ themePreset: "soft", accent: "#c2410c" })).toEqual({ themePreset: "soft", accent: "#C2410C" });
  });

  it.each([
    ["unknown theme", { themePreset: "neon", accent: "#0056FF" }],
    ["a mid-gray accent that fails with white and ink", { themePreset: "clean", accent: "#777777" }],
    ["a malformed accent", { themePreset: "clean", accent: "red" }],
  ])("rejects %s", (_label, input) => {
    expect(pageDesignInput.safeParse(input).success).toBe(false);
  });
});

describe("socialLinkRowsFromForm", () => {
  it("drops empty rows and remembers each link's row on screen", () => {
    const form = profileForm({}, [
      ["website", ""],
      ["x", "https://x.com/maya"],
      ["tiktok", "  "],
      ["instagram", "https://instagram.com/maya"],
    ]);
    expect(socialLinkRowsFromForm(form)).toEqual({
      links: [
        { kind: "x", url: "https://x.com/maya" },
        { kind: "instagram", url: "https://instagram.com/maya" },
      ],
      rows: [1, 3],
    });
  });

  it("never reads more rows than the limit plus one", () => {
    const links = Array.from({ length: 50 }, (_, i): [string, string] => ["website", `https://site${i}.com`]);
    expect(socialLinkRowsFromForm(profileForm({}, links)).links).toHaveLength(7);
  });
});

describe("onAccentFor", () => {
  it("picks white on dark accents and ink on light ones", () => {
    expect(onAccentFor("#0056FF").color).toBe("#FFFFFF");
    expect(onAccentFor("#FFD84D").color).toBe("#0B0D2A");
    expect(onAccentFor("#FFD84D").ratio).toBeGreaterThan(4.5);
  });
});

describe("saveStoreSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "store-1", slug: "maya" });
  });

  it("saves to the session user's own store only, ignoring an ownerId field", async () => {
    storeQueries.updateStoreProfile.mockResolvedValue(true);
    const result = await saveStoreSetup(null, profileForm({ ...profileFields, ownerId: "someone-else" }));
    expect(result?.ok).toBe(true);
    expect(storeQueries.updateStoreProfile).toHaveBeenCalledWith(userId, { ...profile, socialLinks: profile.socialLinks });
  });

  it("never passes theme, slug or publish fields to the profile query", async () => {
    storeQueries.updateStoreProfile.mockResolvedValue(true);
    storeQueries.updateStorePageDesign.mockResolvedValue(true);
    await saveStoreSetup(null, profileForm({ ...profileFields, slug: "taken", isPublished: "true", themePreset: "bold", accent: "#0b0d2a" }));
    const saved = storeQueries.updateStoreProfile.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(saved).sort()).toEqual(["avatarUrl", "bio", "currency", "name", "socialLinks"]);
  });

  it("saves the wizard's theme on the session user's store, through the page design rules", async () => {
    storeQueries.updateStoreProfile.mockResolvedValue(true);
    storeQueries.updateStorePageDesign.mockResolvedValue(true);
    const result = await saveStoreSetup(null, profileForm({ ...profileFields, themePreset: "soft", accent: "#c2410c", ownerId: "someone-else" }));
    expect(result?.ok).toBe(true);
    expect(storeQueries.updateStorePageDesign).toHaveBeenCalledWith(userId, { themePreset: "soft", accent: "#C2410C" });
  });

  it("leaves the theme alone when the form has no theme fields (Settings)", async () => {
    storeQueries.updateStoreProfile.mockResolvedValue(true);
    await saveStoreSetup(null, profileForm(profileFields));
    expect(storeQueries.updateStorePageDesign).not.toHaveBeenCalled();
  });

  it("saves nothing when the wizard's accent is unreadable", async () => {
    const result = await saveStoreSetup(null, profileForm({ ...profileFields, themePreset: "clean", accent: "#777777" }));
    expect(result).toMatchObject({ ok: false, field: "accent" });
    expect(storeQueries.updateStoreProfile).not.toHaveBeenCalled();
    expect(storeQueries.updateStorePageDesign).not.toHaveBeenCalled();
  });

  it("points a bad social link at its row on screen, without saving", async () => {
    const form = profileForm(profileFields, [
      ["website", ""],
      ["x", "http://x.com/maya"],
    ]);
    expect(await saveStoreSetup(null, form)).toMatchObject({ ok: false, field: "socialUrl-1" });
    expect(storeQueries.updateStoreProfile).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to login", async () => {
    mockSession(null);
    expect(await redirectOf(() => saveStoreSetup(null, profileForm(profileFields)))).toBe("/login?next=%2Fdashboard%2Fsettings");
  });

  it("hides database errors", async () => {
    storeQueries.updateStoreProfile.mockRejectedValue(new Error("db down"));
    const result = await saveStoreSetup(null, profileForm(profileFields));
    expect(result).toEqual({ ok: false, error: "Couldn't save your changes. Check your connection and try again." });
  });
});

describe("savePageDesign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "store-1", slug: "maya" });
  });

  it("saves theme and accent on the session user's store", async () => {
    storeQueries.updateStorePageDesign.mockResolvedValue(true);
    const result = await savePageDesign(null, formData({ themePreset: "bold", accent: "#0b0d2a", ownerId: "someone-else" }));
    expect(result?.ok).toBe(true);
    expect(storeQueries.updateStorePageDesign).toHaveBeenCalledWith(userId, { themePreset: "bold", accent: "#0B0D2A" });
  });

  it("rejects a low-contrast accent with its field", async () => {
    expect(await savePageDesign(null, formData({ themePreset: "clean", accent: "#777777" }))).toMatchObject({ ok: false, field: "accent" });
    expect(storeQueries.updateStorePageDesign).not.toHaveBeenCalled();
  });
});

describe("changeUsername", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "store-1", slug: "maya" });
    rateLimit.takeRateLimit.mockResolvedValue(true);
    rateLimit.releaseRateLimit.mockResolvedValue(undefined);
  });

  it("changes the session user's own slug, limited per owner", async () => {
    storeQueries.changeStoreSlug.mockResolvedValue("changed");
    const result = await changeUsername(null, formData({ username: " Maya-Cooks ", ownerId: "someone-else" }));
    expect(result).toEqual({ ok: true, data: { username: "maya-cooks" } });
    expect(storeQueries.changeStoreSlug).toHaveBeenCalledWith(userId, "maya-cooks");
    expect(rateLimit.takeRateLimit).toHaveBeenCalledWith(`username-change:owner:${userId}`, 3, 1440);
  });

  it("treats the unique index as the authority and gives the attempt back when taken", async () => {
    storeQueries.changeStoreSlug.mockResolvedValue("taken");
    expect(await changeUsername(null, formData({ username: "sam" }))).toMatchObject({ ok: false, field: "username" });
    expect(rateLimit.releaseRateLimit).toHaveBeenCalledWith(`username-change:owner:${userId}`);
  });

  it.each([
    ["a reserved name", "checkout"],
    ["the signup route", "signup"],
    ["invalid characters", "maya_cooks"],
    ["too short", "ab"],
  ])("rejects %s before touching the database", async (_label, username) => {
    expect(await changeUsername(null, formData({ username }))).toMatchObject({ ok: false, field: "username" });
    expect(rateLimit.takeRateLimit).not.toHaveBeenCalled();
    expect(storeQueries.changeStoreSlug).not.toHaveBeenCalled();
  });

  it("says so when the name is already theirs", async () => {
    expect(await changeUsername(null, formData({ username: "maya" }))).toEqual({
      ok: false,
      error: "This is already your username.",
      field: "username",
    });
  });

  it("stops after the daily limit", async () => {
    rateLimit.takeRateLimit.mockResolvedValue(false);
    expect(await changeUsername(null, formData({ username: "maya-cooks" }))).toMatchObject({ ok: false, field: "username" });
    expect(storeQueries.changeStoreSlug).not.toHaveBeenCalled();
  });

  it("hides database errors and gives the attempt back", async () => {
    storeQueries.changeStoreSlug.mockRejectedValue(new Error("db down"));
    expect(await changeUsername(null, formData({ username: "maya-cooks" }))).toEqual({
      ok: false,
      error: "Couldn't change your username. Check your connection and try again.",
    });
    expect(rateLimit.releaseRateLimit).toHaveBeenCalled();
  });
});
