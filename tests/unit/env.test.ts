import { describe, expect, it } from "vitest";

import { parseEnv, publicEnvSchema, serverEnvSchema } from "@/lib/env-schema";

const validPublic = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_ROOT_DOMAIN: "localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "example-publishable-key",
};

describe("env schema", () => {
  it("accepts a complete public env", () => {
    expect(parseEnv(publicEnvSchema, validPublic)).toEqual(validPublic);
  });

  it("rejects a missing variable and names it", () => {
    const rest: Partial<typeof validPublic> = { ...validPublic };
    delete rest.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => parseEnv(publicEnvSchema, rest)).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("rejects an invalid URL", () => {
    expect(() =>
      parseEnv(publicEnvSchema, { ...validPublic, NEXT_PUBLIC_APP_URL: "not a url" }),
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("requires the service-role key on the server", () => {
    expect(() => parseEnv(serverEnvSchema, validPublic)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("never includes values in the error message", () => {
    const secret = "super-secret-value";
    try {
      parseEnv(serverEnvSchema, { ...validPublic, NEXT_PUBLIC_APP_URL: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
