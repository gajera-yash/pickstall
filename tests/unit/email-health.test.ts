import { beforeEach, describe, expect, it, vi } from "vitest";

// Admin > Health email check: tells a missing or invalid Resend key and an unverified domain apart,
// without sending anything or exposing the key.

const env = vi.hoisted(() => ({ serverEnv: { RESEND_API_KEY: "re_test_key" as string | undefined, EMAIL_FROM: "Pickstall <login@pickstall.store>" as string | undefined } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => env);
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { checkEmailSetup } from "@/lib/email/health";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("checkEmailSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.serverEnv.RESEND_API_KEY = "re_test_key";
    env.serverEnv.EMAIL_FROM = "Pickstall <login@pickstall.store>";
  });

  it("reports a missing key without calling Resend", async () => {
    env.serverEnv.RESEND_API_KEY = undefined;
    expect(await checkEmailSetup()).toMatchObject({ key: "missing", keySet: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an invalid key", async () => {
    fetchMock.mockResolvedValueOnce(reply({ statusCode: 400, name: "validation_error", message: "API key is invalid" }, 400));
    expect(await checkEmailSetup()).toMatchObject({ key: "invalid", domainStatus: null });
  });

  it("finds the EMAIL_FROM domain and its status, and never returns the key", async () => {
    fetchMock.mockResolvedValueOnce(reply({ data: [{ name: "pickstall.store", status: "verified" }] }));
    const result = await checkEmailSetup();
    expect(result).toMatchObject({ key: "valid", fromDomain: "pickstall.store", domainStatus: "verified", testSender: false });
    expect(JSON.stringify(result)).not.toContain("re_test_key");
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/domains", expect.objectContaining({ headers: { Authorization: "Bearer re_test_key" } }));
  });

  it("says when the domain is missing or not verified, and when the key can only send", async () => {
    fetchMock.mockResolvedValueOnce(reply({ data: [{ name: "other.com", status: "verified" }] }));
    expect(await checkEmailSetup()).toMatchObject({ domainStatus: "not_found" });
    fetchMock.mockResolvedValueOnce(reply({ data: [{ name: "pickstall.store", status: "pending" }] }));
    expect(await checkEmailSetup()).toMatchObject({ domainStatus: "pending" });
    fetchMock.mockResolvedValueOnce(reply({ name: "restricted_api_key", message: "This API key is restricted to only send emails" }, 401));
    expect(await checkEmailSetup()).toMatchObject({ key: "send_only" });
  });

  it("flags Resend's shared test sender", async () => {
    env.serverEnv.EMAIL_FROM = "Pickstall <onboarding@resend.dev>";
    fetchMock.mockResolvedValueOnce(reply({ data: [] }));
    expect(await checkEmailSetup()).toMatchObject({ testSender: true });
  });
});
