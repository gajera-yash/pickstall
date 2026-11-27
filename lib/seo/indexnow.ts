import "server-only";

import { after } from "next/server";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { SITE_URL } from "@/lib/seo/site-facts";

// IndexNow pings when a creator publishes or unpublishes (GEO, D-135). Bing (which feeds ChatGPT
// search and Copilot) and other IndexNow engines then recrawl the store or product page soon, instead
// of waiting for the next sitemap visit. Protocol: https://www.indexnow.org/documentation (POST JSON
// with host, key, keyLocation and urlList; 200 or 202 means received). Runs after the response is
// sent, never blocks or fails a publish, and only for the live site with INDEXNOW_KEY set.

const ENDPOINT = "https://api.indexnow.org/indexnow";
const TIMEOUT_MS = 5000;
/** IndexNow accepts up to 10,000 URLs per request; a publish sends one or two. */
export const INDEXNOW_MAX_URLS = 10000;

export type IndexNowPayload = { host: string; key: string; keyLocation: string; urlList: string[] };

/** The request body for these site paths ("/@store", "/@store/product"), or null when there is nothing to send. */
export function indexNowPayload(key: string, paths: readonly string[]): IndexNowPayload | null {
  const urlList = [...new Set(paths.filter((path) => path.startsWith("/") && !path.startsWith("//")).map((path) => `${SITE_URL}${path}`))].slice(0, INDEXNOW_MAX_URLS);
  if (!urlList.length) return null;
  return { host: new URL(SITE_URL).host, key, keyLocation: `${SITE_URL}/indexnow.txt`, urlList };
}

/** True only on the live site: production build, our real address, and a key to prove it. */
export function indexNowEnabled(): boolean {
  if (process.env.NODE_ENV !== "production" || !serverEnv.INDEXNOW_KEY) return false;
  try {
    return new URL(publicEnv.NEXT_PUBLIC_APP_URL).host === new URL(SITE_URL).host;
  } catch {
    return false;
  }
}

/** Sends the ping now. Never throws: a failed ping is logged (no URLs or key in the log) and forgotten. */
export async function pingIndexNow(paths: readonly string[]): Promise<void> {
  const key = serverEnv.INDEXNOW_KEY;
  if (!key) return;
  const payload = indexNowPayload(key, paths);
  if (!payload) return;
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status !== 200 && response.status !== 202) logger.warn("indexnow.rejected", { status: response.status, count: payload.urlList.length });
  } catch (error) {
    logger.warn("indexnow.failed", { name: error instanceof Error ? error.name : undefined });
  }
}

/** Asks IndexNow engines to recrawl these pages after the current response (live site only). */
export function requestRecrawl(paths: readonly string[]): void {
  if (!indexNowEnabled()) return;
  after(() => pingIndexNow(paths));
}
