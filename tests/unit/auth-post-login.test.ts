import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockStoreQuery, supabase } from "./auth-mocks";

import { DASHBOARD_PATH, USERNAME_PATH, resolvePostLoginPath } from "@/lib/auth/post-login";

const client = supabase as unknown as SupabaseClient;
const userId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolvePostLoginPath", () => {
  it("sends a creator (has a store) to the dashboard", async () => {
    const query = mockStoreQuery({ data: { id: "store-1" }, error: null });
    await expect(resolvePostLoginPath(client, userId, undefined)).resolves.toBe(DASHBOARD_PATH);
    expect(supabase.from).toHaveBeenCalledWith("stores");
    expect(query.eq).toHaveBeenCalledWith("owner_id", userId);
  });

  it("sends a user without a store to the username step", async () => {
    mockStoreQuery({ data: null, error: null });
    await expect(resolvePostLoginPath(client, userId, null)).resolves.toBe(USERNAME_PATH);
  });

  it("uses a safe next path and skips the store lookup", async () => {
    await expect(resolvePostLoginPath(client, userId, "/library/abc?tab=files")).resolves.toBe("/library/abc?tab=files");
    expect(supabase.from).not.toHaveBeenCalled();
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
    mockStoreQuery({ data: null, error: null });
    await expect(resolvePostLoginPath(client, userId, next)).resolves.toBe(USERNAME_PATH);
  });

  it("does not treat lookalike paths as auth pages", async () => {
    await expect(resolvePostLoginPath(client, userId, "/login-help")).resolves.toBe("/login-help");
  });

  it("falls back to the home page if the store lookup fails", async () => {
    mockStoreQuery({ data: null, error: { code: "PGRST000" } });
    await expect(resolvePostLoginPath(client, userId, undefined)).resolves.toBe("/");
  });
});
