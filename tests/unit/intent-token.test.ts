import { describe, expect, it } from "vitest";

import {
  encodeIntentCookie,
  hashIp,
  hashToken,
  newIntentToken,
  nextEmailAttempt,
  parseIntentCookie,
  tokenMatches,
} from "@/lib/auth/intent-token";

const id = "11111111-1111-4111-8111-111111111111";

describe("intent tokens", () => {
  it("creates long random tokens that never repeat", () => {
    const a = newIntentToken();
    const b = newIntentToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("stores only a 64-character hex hash, and matches the right token only", () => {
    const token = newIntentToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenMatches(token, hash)).toBe(true);
    expect(tokenMatches(newIntentToken(), hash)).toBe(false);
    expect(tokenMatches(token, "abc")).toBe(false);
  });

  it("hashes IPs with a secret, so the same IP gives different hashes with different secrets", () => {
    const one = hashIp("203.0.113.7", "secret-number-one");
    expect(one).toMatch(/^[0-9a-f]{64}$/);
    expect(one).not.toContain("203.0.113.7");
    expect(hashIp("203.0.113.7", "secret-number-two")).not.toBe(one);
    expect(hashIp("203.0.113.7", "secret-number-one")).toBe(one);
  });
});

describe("intent cookie", () => {
  it("round-trips id and token", () => {
    const token = newIntentToken();
    expect(parseIntentCookie(encodeIntentCookie(id, token))).toEqual({ id, token });
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["no token", id],
    ["bad id", `not-a-uuid.${"a".repeat(43)}`],
    ["short token", `${id}.abc`],
    ["extra part", `${id}.${"a".repeat(43)}.x`],
    ["sql-ish id", `1;drop table.${"a".repeat(43)}`],
  ])("rejects a %s value", (_label, value) => {
    expect(parseIntentCookie(value)).toBeNull();
  });
});

describe("per-email rate limit (5 attempts in 15 minutes)", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

  it("allows the first attempt and starts a window", () => {
    expect(nextEmailAttempt(null, now)).toEqual({ allowed: true, attempts: 1, windowStartedAt: now });
  });

  it("counts attempts inside the window", () => {
    const result = nextEmailAttempt({ attempts: 3, window_started_at: minutesAgo(5) }, now);
    expect(result).toMatchObject({ allowed: true, attempts: 4 });
  });

  it("blocks the sixth attempt inside the window", () => {
    expect(nextEmailAttempt({ attempts: 5, window_started_at: minutesAgo(14) }, now).allowed).toBe(false);
  });

  it("starts a fresh window after 15 minutes", () => {
    expect(nextEmailAttempt({ attempts: 5, window_started_at: minutesAgo(15) }, now)).toEqual({
      allowed: true,
      attempts: 1,
      windowStartedAt: now,
    });
  });
});
