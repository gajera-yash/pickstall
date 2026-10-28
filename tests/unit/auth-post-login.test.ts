import { beforeEach, describe, expect, it, vi } from "vitest";

import { storeQueries, userId } from "./auth-mocks";

import { DASHBOARD_PATH, USERNAME_PATH, resolvePostLoginPath } from "@/lib/auth/post-login";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolvePostLoginPath", () => {
  it("sends a creator (has a store) to the dashboard", async () => {
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "store-1" });
    await expect(resolvePostLoginPath(userId, undefined)).resolves.toBe(DASHBOARD_PATH);
    expect(storeQueries.findStoreByOwner).toHaveBeenCalledWith(userId);
  });

  it("sends a user without a store to the username step", async () => {
    storeQueries.findStoreByOwner.mockResolvedValue(null);
    await expect(resolvePostLoginPath(userId, null)).resolves.toBe(USERNAME_PATH);
  });

  it("uses a safe next path and skips the store lookup", async () => {
    await expect(resolvePostLoginPath(userId, "/library/abc?tab=files")).resolves.toBe("/library/abc?tab=files");
    expect(storeQueries.findStoreByOwner).not.toHaveBeenCalled();
  });

  it.each([
    ["absolute URL", "https://evil.test"],
    ["protocol-relative", "//evil.test"],
    ["backslash", "/\\evil.test"],
    ["javascript URL", "javascript:alert(1)"],
    ["the root path", "/"],
    ["the login page", "/login"],
    ["a login page with query", "/login?next=/library"],
    ["the auth callback", "/auth/callback?code=x"],
  ])("ignores %s and picks by store", async (_label, next) => {
    storeQueries.findStoreByOwner.mockResolvedValue(null);
    await expect(resolvePostLoginPath(userId, next)).resolves.toBe(USERNAME_PATH);
  });

  it("does not treat lookalike paths as auth pages", async () => {
    await expect(resolvePostLoginPath(userId, "/login-help")).resolves.toBe("/login-help");
  });

  it("falls back to the home page if the store lookup fails", async () => {
    storeQueries.findStoreByOwner.mockRejectedValue(new Error("db down"));
    await expect(resolvePostLoginPath(userId, undefined)).resolves.toBe("/");
  });
});
