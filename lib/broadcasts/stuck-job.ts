import "server-only";

import { failStuckBroadcasts } from "@/lib/broadcasts/queries";
import { inngest } from "@/lib/inngest/client";

/**
 * Every 15 minutes, marks broadcasts failed that have been "sending" with no progress for an hour
 * (D-117): the send job was cut off and will not finish. A live broadcast moves `updatedAt` on
 * every batch of 100, so it is never caught.
 */
export const stuckBroadcastsFunction = inngest.createFunction(
  { id: "broadcasts-fail-stuck", triggers: [{ cron: "TZ=UTC */15 * * * *" }] },
  async ({ step }) => {
    const failed = await step.run("fail-stuck-broadcasts", () => failStuckBroadcasts(new Date()));
    return { failed };
  },
);
