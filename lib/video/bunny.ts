import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env.server";

// Bunny Stream for course lesson videos (D-055), per bunny.net/docs (checked 2026-11-04):
// - Upload: the server creates the video (POST /library/{id}/videos, header AccessKey) and signs a
//   TUS upload: SHA256_HEX(libraryId + apiKey + expires + videoId). The browser uploads straight to
//   Bunny with that signature; the API key never leaves the server.
// - Playback: player.mediadelivery.net/embed/{libraryId}/{videoId}?token=SHA256_HEX(tokenKey +
//   videoId + expires)&expires=..., issued only after an access check (G4).
// - Webhook: HMAC-SHA256 of the raw body with the library's read-only API key, lowercase hex in
//   X-BunnyStream-Signature.

const API = "https://video.bunnycdn.com";
export const BUNNY_TUS_ENDPOINT = `${API}/tusupload`;
const PLAYER = "https://player.mediadelivery.net/embed";

export type BunnyConfig = { libraryId: string; apiKey: string; tokenKey: string; readOnlyKey: string };

/** The Bunny settings when all four are set, else null (video upload is then off). */
export function bunnyConfig(): BunnyConfig | null {
  const { BUNNY_STREAM_LIBRARY_ID: libraryId, BUNNY_STREAM_API_KEY: apiKey, BUNNY_STREAM_TOKEN_KEY: tokenKey, BUNNY_STREAM_READONLY_KEY: readOnlyKey } = serverEnv;
  return libraryId && apiKey && tokenKey && readOnlyKey ? { libraryId, apiKey, tokenKey, readOnlyKey } : null;
}

const sha256Hex = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/** Bunny video ids are GUIDs; checked before one goes into a URL or a signature. */
export const BUNNY_VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signature for a browser TUS upload of `videoId`, valid until `expires` (Unix seconds). */
export function uploadSignature(config: Pick<BunnyConfig, "libraryId" | "apiKey">, videoId: string, expires: number): string {
  return sha256Hex(`${config.libraryId}${config.apiKey}${expires}${videoId}`);
}

/** A signed player link for `videoId` that stops working after `expires` (Unix seconds). */
export function playbackUrl(config: Pick<BunnyConfig, "libraryId" | "tokenKey">, videoId: string, expires: number): string {
  if (!BUNNY_VIDEO_ID.test(videoId)) throw new Error("Invalid video id.");
  const token = sha256Hex(`${config.tokenKey}${videoId}${expires}`);
  return `${PLAYER}/${config.libraryId}/${videoId}?token=${token}&expires=${expires}`;
}

/** True when `signature` is the HMAC-SHA256 (hex) of the raw webhook body with the read-only key. */
export function verifyWebhookSignature(config: Pick<BunnyConfig, "readOnlyKey">, rawBody: Buffer, signature: string | null): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", config.readOnlyKey).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature.toLowerCase(), "hex"));
}

/** Our lesson video status for a Bunny webhook status code, or null for codes we ignore (captions...). */
export function statusFromWebhook(status: number): "processing" | "ready" | "failed" | null {
  if (status === 3) return "ready";
  if (status === 5 || status === 8) return "failed";
  if ([0, 1, 2, 4, 6, 7].includes(status)) return "processing";
  return null;
}

/** Creates an empty video in the library and returns its id. */
export async function createVideo(config: BunnyConfig, title: string): Promise<string> {
  const response = await fetch(`${API}/library/${config.libraryId}/videos`, {
    method: "POST",
    headers: { AccessKey: config.apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ title: title.slice(0, 120) || "Lesson video" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Bunny create video failed (${response.status}).`);
  const body = (await response.json()) as { guid?: unknown };
  if (typeof body.guid !== "string" || !BUNNY_VIDEO_ID.test(body.guid)) throw new Error("Bunny returned no video id.");
  return body.guid;
}

/** Deletes a video from the library. A video that is already gone counts as deleted. */
export async function deleteVideo(config: BunnyConfig, videoId: string): Promise<void> {
  if (!BUNNY_VIDEO_ID.test(videoId)) return;
  const response = await fetch(`${API}/library/${config.libraryId}/videos/${videoId}`, {
    method: "DELETE",
    headers: { AccessKey: config.apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok && response.status !== 404) throw new Error(`Bunny delete video failed (${response.status}).`);
}
