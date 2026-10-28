import { describe, expect, it } from "vitest";

import { parseEnv, publicEnvSchema, serverEnvSchema } from "@/lib/env-schema";

const validPublic = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_ROOT_DOMAIN: "localhost:3000",
};

describe("env schema", () => {
  it("accepts a complete public env", () => {
    expect(parseEnv(publicEnvSchema, validPublic)).toEqual(validPublic);
  });

  it("rejects a missing variable and names it", () => {
    const rest: Partial<typeof validPublic> = { ...validPublic };
    delete rest.NEXT_PUBLIC_ROOT_DOMAIN;
    expect(() => parseEnv(publicEnvSchema, rest)).toThrow(/NEXT_PUBLIC_ROOT_DOMAIN/);
  });

  it("rejects an invalid URL", () => {
    expect(() =>
      parseEnv(publicEnvSchema, { ...validPublic, NEXT_PUBLIC_APP_URL: "not a url" }),
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("requires the MongoDB URI and the auth secret on the server", () => {
    expect(() => parseEnv(serverEnvSchema, validPublic)).toThrow(/MONGODB_URI.*BETTER_AUTH_SECRET/);
  });

  it("accepts a server env with a default database name", () => {
    const env = parseEnv(serverEnvSchema, {
      ...validPublic,
      MONGODB_URI: "mongodb+srv://cluster.example.net",
      BETTER_AUTH_SECRET: "x".repeat(32),
    });
    expect(env.MONGODB_DB).toBe("pickstall");
  });

  it("treats empty optional values as not set", () => {
    const env = parseEnv(serverEnvSchema, {
      ...validPublic,
      MONGODB_URI: "mongodb://127.0.0.1:27017",
      MONGODB_DB: "",
      BETTER_AUTH_SECRET: "x".repeat(32),
      GOOGLE_CLIENT_ID: "",
      RESEND_API_KEY: "",
      IP_HASH_SECRET: "",
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "",
    });
    expect(env).toMatchObject({ MONGODB_DB: "pickstall", GOOGLE_CLIENT_ID: undefined, RESEND_API_KEY: undefined });
  });

  it("rejects a URI that is not MongoDB", () => {
    expect(() =>
      parseEnv(serverEnvSchema, { ...validPublic, MONGODB_URI: "postgres://db", BETTER_AUTH_SECRET: "x".repeat(32) }),
    ).toThrow(/MONGODB_URI/);
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
