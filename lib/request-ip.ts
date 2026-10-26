import "server-only";

import { headers } from "next/headers";

import { hashIp } from "@/lib/auth/intent-token";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";

/**
 * Hash of the client IP for rate limiting, or null. On Vercel the first `x-forwarded-for` entry is
 * the client. The raw IP is never returned or stored. Without IP_HASH_SECRET the per-IP limit is off.
 */
export async function getClientIpHash(): Promise<string | null> {
  const secret = serverEnv.IP_HASH_SECRET;
  if (!secret) {
    logger.warn("rate_limit.ip_hash_secret_missing");
    return null;
  }
  const list = await headers();
  const ip = list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip")?.trim();
  if (!ip || ip.length > 64) return null;
  return hashIp(ip, secret);
}
