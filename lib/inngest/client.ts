import "server-only";

import { Inngest } from "inngest";

import { serverEnv } from "@/lib/env.server";

// Inngest client (D-085). The SDK reads INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY (production) or
// INNGEST_DEV (the local dev server) from the environment itself.
export const inngest = new Inngest({ id: "pickstall" });

/** True when events can be sent: an event key in production, or the local dev server in development. */
export function inngestEnabled(): boolean {
  return Boolean(serverEnv.INNGEST_EVENT_KEY) || (process.env.NODE_ENV !== "production" && Boolean(process.env.INNGEST_DEV));
}
