import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockStoreQuery, redirectOf, supabase } from "./auth-mocks";

import { requireCreator, requireUser } from "@/lib/auth/guards";

const claims = { sub: "11111111-1111-4111-8111-111111111111", email: "maya@example.com" };
const store = { id: "store-1", slug: "maya", name: "Example store", is_published: false };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireUser", () => {
  it("returns the user from verified claims", async () => {
    supabase.auth.getClaims.mockResolvedValue({ data: { claims }, error: null });
    await expect(requireUser()).resolves.toEqual({ id: claims.sub, email: claims.email, prefill: {} });
  });

  it("redirects to /login, keeping a safe next path", async () => {
    supabase.auth.getClaims.mockResolvedValue({ data: null, error: null });
    expect(await redirectOf(() => requireUser("/library"))).toBe("/login?next=%2Flibrary");
  });

  it("treats a claims error as signed out", async () => {
    supabase.auth.getClaims.mockResolvedValue({ data: null, error: new Error("invalid JWT") });
    expect(await redirectOf(() => requireUser("//evil.test"))).toBe("/login");
  });
});

describe("requireCreator", () => {
  it("returns the user and their store", async () => {
    supabase.auth.getClaims.mockResolvedValue({ data: { claims }, error: null });
    const query = mockStoreQuery({ data: store, error: null });

    await expect(requireCreator()).resolves.toEqual({
      user: { id: claims.sub, email: claims.email, prefill: {} },
      store,
    });
    expect(supabase.from).toHaveBeenCalledWith("stores");
    expect(query.eq).toHaveBeenCalledWith("owner_id", claims.sub);
  });

  it("sends a signed-in user without a store to onboarding", async () => {
    supabase.auth.getClaims.mockResolvedValue({ data: { claims }, error: null });
    mockStoreQuery({ data: null, error: null });
    expect(await redirectOf(() => requireCreator())).toBe("/onboarding");
  });

  it("sends a signed-out visitor to login without querying stores", async () => {
    supabase.auth.getClaims.mockResolvedValue({ data: null, error: null });
    expect(await redirectOf(() => requireCreator("/dashboard"))).toBe("/login?next=%2Fdashboard");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("fails closed when the store query errors", async () => {
    supabase.auth.getClaims.mockResolvedValue({ data: { claims }, error: null });
    mockStoreQuery({ data: null, error: { code: "PGRST000" } });
    await expect(requireCreator()).rejects.toThrow("Could not load your store.");
  });
});
