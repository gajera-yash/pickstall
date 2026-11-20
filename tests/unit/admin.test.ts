import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  adminSessions: { insertOne: vi.fn(), findOne: vi.fn(), deleteOne: vi.fn() },
}));
const env = vi.hoisted(() => ({ ADMIN_USERNAME: "founder" as string | undefined, ADMIN_PASSWORD: "correct horse battery" as string | undefined }));
const cookieJar = vi.hoisted(() => ({ value: undefined as string | undefined, set: vi.fn(), delete: vi.fn() }));
const audit = vi.hoisted(() => ({ recordAudit: vi.fn(async () => undefined) }));
const limit = vi.hoisted(() => ({ takeRateLimit: vi.fn(async () => true) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({ serverEnv: env }));
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

import { checkAdminLogin, createAdminSession, findSessionAdmin } from "@/lib/admin/accounts";
import { requireAdmin } from "@/lib/admin/guard";
import { signInAdmin, signOutAdmin } from "@/lib/admin/login-actions";
import { ADMIN_COOKIE, newSessionToken, sessionTokenHash } from "@/lib/admin/session";

const PASSWORD = "correct horse battery";
const form = (username: string, password: string) => {
  const data = new FormData();
  data.set("username", username);
  data.set("password", password);
  return data;
};

/** Captures what createAdminSession stored, so findOne can return it. */
async function storedSession(now: Date) {
  const { token } = await createAdminSession("admin:founder", "iphash", now);
  const doc = db.adminSessions.insertOne.mock.calls.at(-1)?.[0] as Record<string, unknown>;
  return { token, doc };
}

beforeEach(() => {
  vi.clearAllMocks();
  env.ADMIN_USERNAME = "founder";
  env.ADMIN_PASSWORD = PASSWORD;
  cookieJar.value = undefined;
  limit.takeRateLimit.mockResolvedValue(true);
  db.adminSessions.insertOne.mockResolvedValue({});
});

describe("admin credentials from the environment (D-109)", () => {
  it("accept the right username (any case) and password only", () => {
    expect(checkAdminLogin("Founder", PASSWORD)).toEqual({ id: "admin:founder", username: "founder" });
    expect(checkAdminLogin("founder", "wrong password!!")).toBeNull();
    expect(checkAdminLogin("nobody", PASSWORD)).toBeNull();
  });

  it("refuse everyone when the environment has no credentials", async () => {
    env.ADMIN_PASSWORD = undefined;
    expect(checkAdminLogin("founder", PASSWORD)).toBeNull();
    expect(await signInAdmin(null, form("founder", PASSWORD))).toEqual({ error: "Admin sign-in isn't set up on this server." });
    expect(await findSessionAdmin(newSessionToken())).toBeNull();
  });
});

describe("admin sessions in the database (D-109)", () => {
  it("store only the token's hash and a credentials fingerprint, never the password", async () => {
    const now = new Date("2026-11-20T10:00:00Z");
    const { token, doc } = await storedSession(now);
    expect(doc).toEqual({ _id: sessionTokenHash(token), adminId: "admin:founder", credentials: expect.stringMatching(/^[0-9a-f]{32}$/), ipHash: "iphash", createdAt: now, expiresAt: new Date("2026-11-20T18:00:00Z") });
    const raw = JSON.stringify(db.adminSessions.insertOne.mock.calls);
    expect(raw).not.toContain(token);
    expect(raw).not.toContain(PASSWORD);
  });

  it("find the admin of a live session made with the current credentials", async () => {
    const now = new Date("2026-11-20T10:00:00Z");
    const { token, doc } = await storedSession(now);
    db.adminSessions.findOne.mockResolvedValue(doc);
    expect(await findSessionAdmin(token, now)).toEqual({ id: "admin:founder", username: "founder" });
    expect(db.adminSessions.findOne).toHaveBeenCalledWith({ _id: sessionTokenHash(token), expiresAt: { $gt: now } }, expect.anything());
  });

  it("end every session when the password or username changes in the environment", async () => {
    const { token, doc } = await storedSession(new Date());
    db.adminSessions.findOne.mockResolvedValue(doc);
    env.ADMIN_PASSWORD = "a brand new password";
    expect(await findSessionAdmin(token)).toBeNull();
    env.ADMIN_PASSWORD = PASSWORD;
    env.ADMIN_USERNAME = "someone-else";
    expect(await findSessionAdmin(token)).toBeNull();
  });

  it("ignore malformed or unknown tokens", async () => {
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
    const { token, doc } = await storedSession(new Date());
    cookieJar.value = token;
    db.adminSessions.findOne.mockResolvedValue(doc);
    await expect(signOutAdmin()).rejects.toThrow("REDIRECT:/admin/login");
    expect(db.adminSessions.deleteOne).toHaveBeenCalledWith({ _id: sessionTokenHash(token) });
    expect(cookieJar.delete).toHaveBeenCalledWith(ADMIN_COOKIE);
  });
});

describe("admin sign-in (D-109)", () => {
  it("says the same thing for a wrong username or password and logs the failure without them", async () => {
    expect(await signInAdmin(null, form("founder", "nope nope nope"))).toEqual({ error: "Wrong username or password." });
    expect(await signInAdmin(null, form("intruder", PASSWORD))).toEqual({ error: "Wrong username or password." });
    expect(cookieJar.set).not.toHaveBeenCalled();
    expect(JSON.stringify(audit.recordAudit.mock.calls)).not.toContain("intruder");
  });

  it("stops after too many tries", async () => {
    limit.takeRateLimit.mockResolvedValue(false);
    expect(await signInAdmin(null, form("founder", PASSWORD))).toEqual({ error: "Too many tries. Wait 15 minutes, then try again." });
    expect(db.adminSessions.insertOne).not.toHaveBeenCalled();
  });

  it("creates a database session and a strict httpOnly cookie, then opens the dashboard", async () => {
    await expect(signInAdmin(null, form("founder", PASSWORD))).rejects.toThrow("REDIRECT:/admin");
    expect(db.adminSessions.insertOne).toHaveBeenCalledWith(expect.objectContaining({ adminId: "admin:founder" }));
    expect(cookieJar.set).toHaveBeenCalledWith(ADMIN_COOKIE, expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), expect.objectContaining({ httpOnly: true, sameSite: "strict", path: "/" }));
    expect(audit.recordAudit).toHaveBeenCalledWith({ actorId: "admin:founder", action: "admin.signed_in", ipHash: "iphash" });
  });
});
