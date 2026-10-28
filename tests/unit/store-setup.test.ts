import { beforeEach, describe, expect, it, vi } from "vitest";

import { formData, mockSession, redirectOf, storeQueries, userId } from "./auth-mocks";

import { saveStoreSetup } from "@/lib/stores/actions";
import { storeSetupInput } from "@/lib/stores/schemas";
import { onAccentFor } from "@/lib/themes";

const valid = {
  name: "Maya's Kitchen",
  bio: "Quick dinners.",
  avatarUrl: "https://images.example.com/maya.jpg",
  link: "https://youtube.com/@maya",
  currency: "gbp",
  themePreset: "soft",
  accent: "#c2410c",
};

describe("storeSetupInput", () => {
  it("accepts a complete form and normalizes the accent", () => {
    expect(storeSetupInput.parse(valid)).toEqual({ ...valid, accent: "#C2410C" });
  });

  it("turns empty optional fields into undefined", () => {
    expect(storeSetupInput.parse({ ...valid, bio: " ", avatarUrl: "", link: "" })).toMatchObject({
      bio: undefined,
      avatarUrl: undefined,
      link: undefined,
    });
  });

  it.each([
    ["http link", { link: "http://example.com" }],
    ["javascript link", { link: "javascript:alert(1)" }],
    ["data image", { avatarUrl: "data:image/png;base64,AAAA" }],
    ["credentials in link", { link: "https://user:pass@example.com" }],
    ["unknown currency", { currency: "inr" }],
    ["unknown theme", { themePreset: "neon" }],
    ["control characters in the name", { name: "Maya\u0000" }],
    ["a too-long bio", { bio: "x".repeat(201) }],
    ["a mid-gray accent that fails with white and ink", { accent: "#777777" }],
    ["a malformed accent", { accent: "red" }],
  ])("rejects %s", (_label, override) => {
    expect(storeSetupInput.safeParse({ ...valid, ...override }).success).toBe(false);
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

  it("saves to the session user's own store only", async () => {
    storeQueries.updateStoreSetup.mockResolvedValue(true);
    const result = await saveStoreSetup(null, formData({ ...valid, ownerId: "someone-else" }));
    expect(result?.ok).toBe(true);
    expect(storeQueries.updateStoreSetup).toHaveBeenCalledWith(userId, expect.objectContaining({ name: "Maya's Kitchen" }));
  });

  it("returns the first problem with its field, without saving", async () => {
    expect(await saveStoreSetup(null, formData({ ...valid, link: "http://x.com" }))).toMatchObject({ ok: false, field: "link" });
    expect(storeQueries.updateStoreSetup).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to login", async () => {
    mockSession(null);
    expect(await redirectOf(() => saveStoreSetup(null, formData(valid)))).toBe("/login?next=%2Fdashboard%2Fstore");
  });

  it("hides database errors", async () => {
    storeQueries.updateStoreSetup.mockRejectedValue(new Error("db down"));
    const result = await saveStoreSetup(null, formData(valid));
    expect(result).toEqual({ ok: false, error: "Couldn't save your store. Check your connection and try again." });
  });
});
