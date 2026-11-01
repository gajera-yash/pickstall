"use server";

import { z } from "zod";

import { USERNAME_CHECK_RATE_LIMIT } from "@/lib/config";
import { usernameCheckError } from "@/lib/db/errors";
import { logger } from "@/lib/logger";
import { rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/request-ip";
import { SLUG_TAKEN_MESSAGE, isReservedSlug, slugSchema, usernameCandidates } from "@/lib/slug";
import { findTakenSlugs, isSlugTaken } from "@/lib/stores/slug-availability";

export type UsernameCheck =
  | { status: "available"; username: string }
  | { status: "taken"; username: string; message: string; suggestions: string[] }
  | { status: "invalid"; username: string; message: string }
  | { status: "error"; username: string; message: string };

const MAX_SUGGESTIONS = 3;

/**
 * Live username check while typing (signup and the username step). Says only whether the name is
 * free, plus up to three free alternatives. Not a reservation: the unique index decides on create.
 * Usernames are public store links, so this reveals nothing private. Rate-limited per IP.
 */
export async function checkUsername(raw: unknown): Promise<UsernameCheck> {
  const input = z.string().max(64).safeParse(raw);
  const username = input.success ? input.data.trim().toLowerCase() : "";
  const parsed = slugSchema.safeParse(username);

  if (!parsed.success) {
    // Reserved names read as taken (slugSchema gives them the taken message) and get suggestions.
    if (!isReservedSlug(username)) {
      return { status: "invalid", username, message: parsed.error.issues[0]?.message ?? "Check the username." };
    }
  }

  try {
    const ipHash = await getClientIpHash();
    const { max, windowMinutes } = USERNAME_CHECK_RATE_LIMIT;
    if (ipHash && !(await takeRateLimit(rateLimitKey("username-check:ip", ipHash), max, windowMinutes))) {
      return { status: "error", username, message: "Slow down a little, then try again." };
    }

    if (parsed.success) {
      const taken = await isSlugTaken(username);
      if (!taken.ok) return { status: "error", username, message: taken.error };
      if (!taken.data) return { status: "available", username };
    }

    const candidates = usernameCandidates(username);
    const unavailable = await findTakenSlugs(candidates);
    const suggestions = candidates.filter((candidate) => !unavailable.has(candidate)).slice(0, MAX_SUGGESTIONS);
    return { status: "taken", username, message: SLUG_TAKEN_MESSAGE, suggestions };
  } catch (error) {
    logger.error("username_check.failed", { name: error instanceof Error ? error.name : undefined });
    return { status: "error", username, message: usernameCheckError(error) };
  }
}
