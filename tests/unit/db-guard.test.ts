import { describe, expect, it } from "vitest";

import { assertDevProject } from "../db/guard";

const ref = "abcdefghijklmnopqrst";
const validEnv = {
  DB_TESTS_ALLOW: "dev-only",
  SUPABASE_DEV_PROJECT_REF: ref,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "example-publishable-key",
  SUPABASE_SERVICE_ROLE_KEY: "example-secret-key",
};
const noLinkFile = { readLinkedRef: () => null };

describe("DB test guard", () => {
  it("allows the configured dev project", () => {
    expect(assertDevProject(validEnv, noLinkFile)).toBe(ref);
  });

  it("allows it when the CLI is linked to the same project", () => {
    expect(assertDevProject(validEnv, { readLinkedRef: () => ref })).toBe(ref);
  });

  it.each([
    ["no opt-in", { DB_TESTS_ALLOW: undefined }],
    ["wrong opt-in", { DB_TESTS_ALLOW: "yes" }],
    ["production", { NODE_ENV: "production" }],
    ["Vercel", { VERCEL_ENV: "preview" }],
    ["CI", { CI: "true" }],
    ["missing ref", { SUPABASE_DEV_PROJECT_REF: undefined }],
    ["malformed ref", { SUPABASE_DEV_PROJECT_REF: "ABC.def" }],
    ["URL of another project", { NEXT_PUBLIC_SUPABASE_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co" }],
    ["look-alike host", { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co.evil.test` }],
    ["http URL", { NEXT_PUBLIC_SUPABASE_URL: `http://${ref}.supabase.co` }],
    ["local URL", { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }],
    ["URL with path", { NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co/rest` }],
    ["not a URL", { NEXT_PUBLIC_SUPABASE_URL: "nope" }],
    ["missing service key", { SUPABASE_SERVICE_ROLE_KEY: undefined }],
  ])("refuses: %s", (_label, override) => {
    expect(() => assertDevProject({ ...validEnv, ...override }, noLinkFile)).toThrow(
      /DB tests refused to run/,
    );
  });

  it("refuses when the CLI is linked to a different project", () => {
    expect(() =>
      assertDevProject(validEnv, { readLinkedRef: () => "zzzzzzzzzzzzzzzzzzzz" }),
    ).toThrow(/linked to a different project/);
  });

  it("never puts key values in the error", () => {
    try {
      assertDevProject({ ...validEnv, DB_TESTS_ALLOW: "no" }, noLinkFile);
    } catch (error) {
      expect(String(error)).not.toContain("example-secret-key");
    }
  });
});
