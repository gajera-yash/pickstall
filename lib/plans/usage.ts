import "server-only";

import { collections } from "@/lib/db/collections";

// What a store uses of its plan (D-098): courses and course video. Always the store id from the
// verified session.

const NOT_DELETED = { deletedAt: { $in: [null] } };

/** Courses the store has (drafts too), for the plan's course limit on creating. */
export async function countCourses(storeId: string): Promise<number> {
  const { products } = await collections();
  return products.countDocuments({ storeId, type: "course", ...NOT_DELETED });
}

/** Published courses other than `exceptId`, for the limit on publishing (after a downgrade). */
export async function countPublishedCourses(storeId: string, exceptId: string): Promise<number> {
  const { products } = await collections();
  return products.countDocuments({ storeId, type: "course", status: "published", _id: { $ne: exceptId }, ...NOT_DELETED });
}

/** Seconds of uploaded course video (Bunny), from the lengths saved when each video was ready. */
export async function videoSecondsUsed(storeId: string): Promise<number> {
  const { lessons } = await collections();
  const [row] = await lessons
    .aggregate<{ total: number }>([{ $match: { storeId, "video.kind": "bunny" } }, { $group: { _id: null, total: { $sum: { $ifNull: ["$video.durationSeconds", 0] } } } }])
    .toArray();
  return row?.total ?? 0;
}
