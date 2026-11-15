import "server-only";

import { canonicalEmail, isDisposableEmail } from "@/lib/auth/email-rules";
import { STORE_CREATION_LIMITS } from "@/lib/config";
import { collections } from "@/lib/db/collections";
import { peekRateLimit, rateLimitKey, takeRateLimit } from "@/lib/rate-limit";
import { NEW_STORE_MESSAGES, type NewStoreBlock } from "@/lib/stores/new-store-messages";

// The one gate before a new store (and its free trial) is created (Phase A, D-071). Signup, the
// login page (which creates accounts on first sign-in) and Google all end in createDraftStore, so
// the checks live here instead of on one form. The unique index on stores.ownerEmailKey is the final
// word on "one store per inbox"; this check only gives a clear message first.

export type NewStoreCheck = { ok: true } | { ok: false; reason: NewStoreBlock; message: string };

const WINDOW_MINUTES = STORE_CREATION_LIMITS.windowDays * 24 * 60;

function limitKeys(device: string | null, ipHash: string | null) {
  return {
    device: device ? rateLimitKey("store-create:device", device) : null,
    ip: ipHash ? rateLimitKey("store-create:ip", ipHash) : null,
  };
}

const block = (reason: NewStoreBlock): NewStoreCheck => ({ ok: false, reason, message: NEW_STORE_MESSAGES[reason] });

/** May this verified user open a store? `ownerId` and `email` come from the session. */
export async function checkNewStore(input: { ownerId: string; email: string; device: string | null; ipHash: string | null }): Promise<NewStoreCheck> {
  if (isDisposableEmail(input.email)) return block("disposable");

  const key = canonicalEmail(input.email);
  if (key) {
    const { stores } = await collections();
    const other = await stores.findOne({ ownerEmailKey: key, ownerId: { $ne: input.ownerId } }, { projection: { _id: 1 } });
    if (other) return block("email_used");
  }

  const keys = limitKeys(input.device, input.ipHash);
  const [byDevice, byIp] = await Promise.all([keys.device ? peekRateLimit(keys.device) : 0, keys.ip ? peekRateLimit(keys.ip) : 0]);
  if (byDevice >= STORE_CREATION_LIMITS.perDevice || byIp >= STORE_CREATION_LIMITS.perIp) return block("limit");
  return { ok: true };
}

/** Counts a store that was just created against this browser and IP. */
export async function recordNewStore(input: { device: string | null; ipHash: string | null }): Promise<void> {
  const keys = limitKeys(input.device, input.ipHash);
  // The max is never hit here: checkNewStore decides; this only counts.
  await Promise.all([
    keys.device ? takeRateLimit(keys.device, Number.MAX_SAFE_INTEGER, WINDOW_MINUTES) : null,
    keys.ip ? takeRateLimit(keys.ip, Number.MAX_SAFE_INTEGER, WINDOW_MINUTES) : null,
  ]);
}
