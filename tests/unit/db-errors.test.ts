import { describe, expect, it } from "vitest";

import { databaseHint, usernameCheckError } from "@/lib/db/errors";

function named(name: string, message: string, code?: number): Error {
  return Object.assign(new Error(message), { name, ...(code === undefined ? {} : { code }) });
}

describe("databaseHint", () => {
  it("explains the usual connection failures", () => {
    expect(databaseHint(named("MongoServerSelectionError", "Server selection timed out after 30000 ms"))).toMatch(/Network Access/);
    expect(databaseHint(named("MongoServerError", "bad auth : authentication failed", 18))).toMatch(/password/);
    expect(databaseHint(named("MongoAPIError", "querySrv ENOTFOUND _mongodb._tcp.cluster0.x.mongodb.net"))).toMatch(/DNS/);
    expect(databaseHint(new Error("Missing or invalid environment variables: MONGODB_URI"))).toMatch(/pnpm doctor/);
  });

  it("returns null for anything else", () => {
    expect(databaseHint(new Error("something odd"))).toBeNull();
  });
});

describe("usernameCheckError", () => {
  const timeout = named("MongoServerSelectionError", "Server selection timed out");

  it("never shows details in production", () => {
    expect(usernameCheckError(timeout, false)).toBe("Couldn't check that username. Try again.");
  });

  it("gives the fix in development, or at least the error name", () => {
    expect(usernameCheckError(timeout, true)).toMatch(/Network Access/);
    expect(usernameCheckError(new TypeError("x"), true)).toMatch(/TypeError/);
  });
});
