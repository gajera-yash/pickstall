import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({ serverEnv: {} }));
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { usesTestSender } from "@/lib/email/send";

// Resend's test sender only delivers to the Resend account owner (founder bug report, 2026-11-17).

describe("usesTestSender", () => {
  it("is true without EMAIL_FROM or with a resend.dev address", () => {
    expect(usesTestSender(undefined)).toBe(true);
    expect(usesTestSender("")).toBe(true);
    expect(usesTestSender("Pickstall <onboarding@resend.dev>")).toBe(true);
    expect(usesTestSender("onboarding@resend.dev")).toBe(true);
  });

  it("is false for an address on the creator platform's own domain", () => {
    expect(usesTestSender("Pickstall <orders@pickstall.store>")).toBe(false);
    expect(usesTestSender("login@mail.pickstall.store")).toBe(false);
    expect(usesTestSender("Team <hi@resend.dev.example.com>")).toBe(false);
  });
});
