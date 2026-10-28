import { beforeEach, describe, expect, it, vi } from "vitest";

import { rateLimit, slugs } from "./auth-mocks";

import { checkUsername } from "@/lib/stores/username-check";

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.takeRateLimit.mockResolvedValue(true);
  slugs.findTakenSlugs.mockResolvedValue(new Set());
});

describe("checkUsername", () => {
  it("says a free username is available", async () => {
    slugs.isSlugTaken.mockResolvedValue({ ok: true, data: false });
    expect(await checkUsername("Maya")).toEqual({ status: "available", username: "maya" });
    expect(slugs.isSlugTaken).toHaveBeenCalledWith("maya");
  });

  it("offers up to three free suggestions for a taken username", async () => {
    slugs.isSlugTaken.mockResolvedValue({ ok: true, data: true });
    slugs.findTakenSlugs.mockResolvedValue(new Set(["maya-store"]));
    expect(await checkUsername("maya")).toEqual({
      status: "taken",
      username: "maya",
      message: "That username is taken. Try another.",
      suggestions: ["maya-official", "hey-maya", "maya-shop"],
    });
  });

  it("treats reserved names as taken, without a database lookup for them", async () => {
    const result = await checkUsername("dashboard");
    expect(result).toMatchObject({ status: "taken" });
    expect(slugs.isSlugTaken).not.toHaveBeenCalled();
  });

  it("explains an invalid username without touching the database", async () => {
    expect(await checkUsername("-maya")).toMatchObject({ status: "invalid", message: "Start and end with a letter or number." });
    expect(await checkUsername({ $ne: null })).toMatchObject({ status: "invalid" });
    expect(slugs.isSlugTaken).not.toHaveBeenCalled();
    expect(rateLimit.takeRateLimit).not.toHaveBeenCalled();
  });

  it("hides database errors", async () => {
    slugs.isSlugTaken.mockRejectedValue(new Error("db down"));
    const result = await checkUsername("maya");
    expect(result).toEqual({ status: "error", username: "maya", message: "Couldn't check that username. Try again." });
  });
});
