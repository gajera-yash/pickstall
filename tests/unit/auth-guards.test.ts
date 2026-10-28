import { beforeEach, describe, expect, it, vi } from "vitest";

import { authApi, mockSession, redirectOf, storeQueries, userId } from "./auth-mocks";

import { requireCreator, requireUser } from "@/lib/auth/guards";

const user = { id: userId, email: "maya@example.com" };
const store = { id: "store-1", slug: "maya", name: "Example store", isPublished: false };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireUser", () => {
  it("returns the user from the server-checked session", async () => {
    mockSession(user);
    await expect(requireUser()).resolves.toEqual(user);
  });

  it("redirects to /login, keeping a safe next path", async () => {
    mockSession(null);
    expect(await redirectOf(() => requireUser("/library"))).toBe("/login?next=%2Flibrary");
  });

  it("treats a session lookup error as signed out", async () => {
    authApi.getSession.mockRejectedValue(new Error("db down"));
    expect(await redirectOf(() => requireUser("//evil.test"))).toBe("/login");
  });
});

describe("requireCreator", () => {
  it("returns the user and their own store, looked up by the session user id", async () => {
    mockSession(user);
    storeQueries.findStoreByOwner.mockResolvedValue(store);
    await expect(requireCreator()).resolves.toEqual({ user, store });
    expect(storeQueries.findStoreByOwner).toHaveBeenCalledWith(userId);
  });

  it("sends a signed-in user without a store to the username step", async () => {
    mockSession(user);
    storeQueries.findStoreByOwner.mockResolvedValue(null);
    expect(await redirectOf(() => requireCreator())).toBe("/signup/username");
  });

  it("sends a signed-out visitor to login without querying stores", async () => {
    mockSession(null);
    expect(await redirectOf(() => requireCreator("/dashboard"))).toBe("/login?next=%2Fdashboard");
    expect(storeQueries.findStoreByOwner).not.toHaveBeenCalled();
  });

  it("fails closed when the store query errors", async () => {
    mockSession(user);
    storeQueries.findStoreByOwner.mockRejectedValue(new Error("db down"));
    await expect(requireCreator()).rejects.toThrow("Could not load your store.");
  });
});
