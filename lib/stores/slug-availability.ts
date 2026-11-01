import "server-only";

import { collections } from "@/lib/db/collections";
import { usernameCheckError } from "@/lib/db/errors";
import { logger } from "@/lib/logger";
import { err, ok, type Result } from "@/lib/result";

/**
 * Is this username already used by a store (published or not)? Returns only a yes/no, nothing
 * about the owner. Not a guarantee: the unique index decides when the store is created.
 */
export async function isSlugTaken(slug: string): Promise<Result<boolean>> {
  try {
    const { stores } = await collections();
    const found = await stores.findOne({ slug }, { projection: { _id: 1 } });
    return ok(found !== null);
  } catch (error) {
    logger.error("stores.slug_check_failed", { name: error instanceof Error ? error.name : undefined });
    return err(usernameCheckError(error), "username");
  }
}

/** Which of these usernames already belong to a store. Used to offer free suggestions only. */
export async function findTakenSlugs(slugs: string[]): Promise<Set<string>> {
  if (slugs.length === 0) return new Set();
  const { stores } = await collections();
  const found = await stores.find({ slug: { $in: slugs } }, { projection: { slug: 1, _id: 0 } }).toArray();
  return new Set(found.map((doc) => doc.slug));
}
