import "server-only";

import { cache } from "react";

import { collections } from "@/lib/db/collections";

export type Profile = { fullName: string | null; phone: string | null };

/**
 * The signed-in user's own profile, or null if none was saved yet. Cached per request (the
 * dashboard layout and page both read it), so it costs one database round trip.
 */
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const { profiles } = await collections();
  const doc = await profiles.findOne({ _id: userId }, { projection: { fullName: 1, phone: 1 } });
  return doc ? { fullName: doc.fullName, phone: doc.phone } : null;
});

/** Creates or updates the user's profile. Only the given fields change. */
export async function saveProfile(
  userId: string,
  email: string,
  changes: { fullName?: string; phone?: string | null },
): Promise<void> {
  const { profiles } = await collections();
  const now = new Date();
  await profiles.updateOne(
    { _id: userId },
    {
      $set: { email, ...changes, updatedAt: now },
      $setOnInsert: {
        ...(changes.fullName === undefined ? { fullName: null } : {}),
        ...(changes.phone === undefined ? { phone: null } : {}),
        createdAt: now,
      },
    },
    { upsert: true },
  );
}
