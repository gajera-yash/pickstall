import "server-only";

import { cache } from "react";

import { collections } from "@/lib/db/collections";
import { isSeenId } from "@/lib/tours/catalog";

// Which tours and "New" hotspots a creator has seen (D-128), kept per user so a tour never comes
// back on another device. Every function takes the user id from the verified session.

/** The tour and hotspot ids this user has seen. Cached per request. */
export const seenTours = cache(async (userId: string): Promise<string[]> => {
  const { tourProgress } = await collections();
  const doc = await tourProgress.findOne({ _id: userId }, { projection: { seen: 1 } });
  return (doc?.seen ?? []).filter(isSeenId);
});

/** Records one id as seen (a known tour or hotspot id only). */
export async function markTourSeen(userId: string, id: string, now: Date = new Date()): Promise<void> {
  if (!isSeenId(id)) return;
  const { tourProgress } = await collections();
  await tourProgress.updateOne({ _id: userId }, { $addToSet: { seen: id }, $set: { updatedAt: now } }, { upsert: true });
}

/** Forgets every tour (not the hotspots), for "Take the tour again". */
export async function resetTours(userId: string, tourIds: readonly string[], now: Date = new Date()): Promise<void> {
  const { tourProgress } = await collections();
  await tourProgress.updateOne({ _id: userId }, { $pull: { seen: { $in: [...tourIds] } }, $set: { updatedAt: now } });
}
