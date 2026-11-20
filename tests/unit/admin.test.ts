import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  adminUsers: { findOne: vi.fn(), updateOne: vi.fn() },
  adminSessions: { insertOne: vi.fn(), findOne: vi.fn(), deleteOne: vi.fn(), deleteMany: vi.fn() },
}));
const cookieJar = vi.hoisted(() => ({ value: undefined as string | undefined, set: vi.fn(), delete: vi.fn() }));
const audit = vi.hoisted(() => ({ recordAudit: vi.fn(async () => undefined) }));
const limit = vi.hoisted(() => ({ takeRateLimit: vi.fn(async () => true) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookieJar.value ? { value: cookieJar.value } : undefined), set: cookieJar.set, delete: cookieJar.delete }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/audit/log", () => audit);
vi.mock("@/lib/rate-limit", () => ({ rateLimitKey: (...parts: string[]) => parts.join(":"), takeRateLimit: limit.takeRateLimit }));
vi.mock("@/lib/request-ip", () => ({ getClientIpHash: vi.fn(async () => "iphash") }));

import { changeAdminPassword, checkAdminLogin, createAdminSession, findSessionAdmin } from "@/lib/admin/accounts";
import { requireAdmin } from "@/lib/admin/guard";
import { signInAdmin, signOutAdmin } from "@/lib/admin/login-actions";
import { ADMIN_COOKIE, hashPassword, newSessionToken, sessionTokenHash, verifyPassword } from "@/lib/admin/session";

const PASSWORD = "correct horse battery";
const fast = { N: 1024, r: 8, p: 1 };
const ADMIN = { _id: "admin-1", username: "founder", passwordHash: hashPassword(PASSWORD, undefined, fast) };
const form = (username: string, password: string) => {
  const data = new FormData();
  data.set("username", username);
  data.set("password", password);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.value = undefined;
  limit.takeRateLimit.mockResolvedValue(true);
  db.adminUsers.updateOne.mockResolvedValue({});
  db.adminSessions.insertOne.mockResolvedValue({});
});

describe("admin passwords (D-108)", () => {
  it("verify the right password only and refuse malformed hashes", () => {
    expect(verifyPassword(PASSWORD, ADMIN.passwordHash)).toBe(true);
    expect(verifyPassword("wrong password!!", ADMIN.passwordHash)).toBe(false);
    expect(verifyPassword(PASSWORD, "plain-text")).toBe(false);
  });

  it("check a login by lower-case username, and fail the same way for an unknown one", async () => {
    db.adminUsers.findOne.mockResolvedValue(ADMIN);
    expect(await checkAdminLogin("Founder", PASSWORD)).toEqual({ id: "admin-1", username: "founder" });
    expect(db.adminUsers.findOne).toHaveBeenCalledWith({ usernameKey: "founder" }, expect.anything());
    expect(await checkAdminLogin("founder", "wrong password!!")).toBeNull();
    db.adminUsers.findOne.mockResolvedValue(null);
    expect(await checkAdminLogin("nobody", PASSWORD)).toBeNull();
  });
});

describe("admin sessions in the database (D-108)", () => {
  it("store only the token's hash, and find the admin of a live session", async () => {
    const now = new Date("2026-11-20T10:00:00Z");
    const { token, expiresAt } = await createAdminSession("admin-1", "iphash", now);
    expect(db.adminSessions.insertOne).toHaveBeenCalledWith({ _id: sessionTokenHash(token), adminId: "admin-1", ipHash: "iphash", createdAt: now, expiresAt });
    expect(expiresAt).toEqual(new Date("2026-11-20T18:00:00Z"));
    expect(JSON.stringify(db.adminSessions.insertOne.mock.calls)).not.toContain(token);

    db.adminSessions.findOne.mockResolvedValue({ adminId: "admin-1" });
    db.adminUsers.findOne.mockResolvedValue({ _id: "admin-1", username: "founder" });
    expect(await findSessionAdmin(token, now)).toEqual({ id: "admin-1", username: "founder" });
    expect(db.adminSessions.findOne).toHaveBeenCalledWith({ _id: sessionTokenHash(token), expiresAt: { $gt: now } }, expect.anything());
  });

  it("ignore malformed, unknown or expired tokens", async () => {
    expect(await findSessionAdmin("not-a-token")).toBeNull();
    expect(db.adminSessions.findOne).not.toHaveBeenCalled();
    db.adminSessions.findOne.mockResolvedValue(null);
    expect(await findSessionAdmin(newSessionToken())).toBeNull();
  });

  it("send visitors without a live session to the sign-in page", async () => {
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
    cookieJar.value = newSessionToken();
    db.adminSessions.findOne.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("sign out deletes the session from the database", async () => {
    const token = newSessionToken();
    cookieJar.value = token;
    db.adminSessions.findOne.mockResolvedValue({ adminId: "admin-1" });
    db.adminUsers.findOne.mockResolvedValue({ _id: "admin-1", username: "founder" });
    await expect(signOutAdmin()).rejects.toThrow("REDIRECT:/admin/login");
    expect(db.adminSessions.deleteOne).toHaveBeenCalledWith({ _id: sessionTokenHash(token) });
    expect(cookieJar.delete).toHaveBeenCalledWith(ADMIN_COOKIE);
  });

  it("a password change checks the current one and signs out the other sessions", async () => {
    db.adminUsers.findOne.mockResolvedValue(ADMIN);
    expect(await changeAdminPassword("admin-1", "wrong password!!", "a brand new password", undefined)).toMatch(/current password/);
    expect(await changeAdminPassword("admin-1", PASSWORD, "short", undefined)).toMatch(/12 characters/);
    const keep = newSessionToken();
    expect(await changeAdminPassword("admin-1", PASSWORD, "a brand new password", keep)).toBeNull();
    expect(db.adminSessions.deleteMany).toHaveBeenCalledWith({ adminId: "admin-1", _id: { $ne: sessionTokenHash(keep) } });
  });
});

describe("admin sign-in (D-108)", () => {
  it("says the same thing for a wrong username or password and logs the failure without them", async () => {
    db.adminUsers.findOne.mockResolvedValue(ADMIN);
    expect(await signInAdmin(null, form("founder", "nope nope nope"))).toEqual({ error: "Wrong username or password." });
    db.adminUsers.findOne.mockResolvedValue(null);
    expect(await signInAdmin(null, form("intruder", PASSWORD))).toEqual({ error: "Wrong username or password." });
    expect(cookieJar.set).not.toHaveBeenCalled();
    expect(JSON.stringify(audit.recordAudit.mock.calls)).not.toContain("intruder");
  });

  it("stops after too many tries", async () => {
    limit.takeRateLimit.mockResolvedValue(false);
    expect(await signInAdmin(null, form("founder", PASSWORD))).toEqual({ error: "Too many tries. Wait 15 minutes, then try again." });
    expect(db.adminUsers.findOne).not.toHaveBeenCalled();
  });

  it("creates a database session and a strict httpOnly cookie, then opens the dashboard", async () => {
    db.adminUsers.findOne.mockResolvedValue(ADMIN);
    await expect(signInAdmin(null, form("founder", PASSWORD))).rejects.toThrow("REDIRECT:/admin");
    expect(db.adminSessions.insertOne).toHaveBeenCalledWith(expect.objectContaining({ adminId: "admin-1" }));
    expect(cookieJar.set).toHaveBeenCalledWith(ADMIN_COOKIE, expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), expect.objectContaining({ httpOnly: true, sameSite: "strict", path: "/" }));
    expect(audit.recordAudit).toHaveBeenCalledWith({ actorId: "admin:founder", action: "admin.signed_in", ipHash: "iphash" });
  });
});
