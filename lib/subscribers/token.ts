import "server-only";

import { randomBytes } from "node:crypto";

/** A random, unguessable token for someone's unsubscribe links (D-095): 32 URL-safe characters. */
export function newUnsubscribeToken(): string {
  return randomBytes(24).toString("base64url");
}
