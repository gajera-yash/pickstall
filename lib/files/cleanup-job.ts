import "server-only";

import { cleanupPendingUploads } from "@/lib/files/uploads";
import { inngest } from "@/lib/inngest/client";

/**
 * Once a day, deletes file uploads that were started but never finished (D-093): their record
 * and, if any arrived, their bytes in R2 or on the disk.
 */
export const pendingUploadsCleanupFunction = inngest.createFunction(
  { id: "files-pending-uploads-cleanup", triggers: [{ cron: "TZ=UTC 30 3 * * *" }] },
  async ({ step }) => {
    const removed = await step.run("remove-stale-uploads", () => cleanupPendingUploads(new Date()));
    return { removed };
  },
);
