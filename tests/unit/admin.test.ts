import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({ serverEnv: { ADMIN_EMAILS: undefined } }));
vi.mock("@/lib/auth/guards", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { getCurrentUser } from "@/lib/auth/guards";
import { adminEmails, isAdminEmail, requireAdmin } from "@/lib/admin/guard";

describe("platform admin access (D-104)", () => {
  it("reads a comma-separated list, case-insensitively, ignoring junk", () => {
    expect([...adminEmails(" Founder@Pickstall.store , ,nope, ops@pickstall.store ")]).toEqual(["founder@pickstall.store", "ops@pickstall.store"]);
    expect(isAdminEmail("FOUNDER@pickstall.store", "founder@pickstall.store")).toBe(true);
    expect(isAdminEmail("someone@else.com", "founder@pickstall.store")).toBe(false);
    expect(isAdminEmail(null, "founder@pickstall.store")).toBe(false);
  });

  it("lets nobody in when ADMIN_EMAILS is not set", () => {
    expect(adminEmails(undefined).size).toBe(0);
    expect(isAdminEmail("founder@pickstall.store", "")).toBe(false);
  });

  it("answers 404 to signed-out users and non-admins", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "u1", email: "creator@example.com" });
    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
