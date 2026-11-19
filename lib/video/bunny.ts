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

/**
 * Library id and API key turn on upload, delete and status checks. The token key signs playback
 * links (needed in production); the read-only key verifies the webhook (needed once the site is
 * online, since Bunny cannot call localhost).
 */
export type BunnyConfig = { libraryId: string; apiKey: string; tokenKey: string | null; readOnlyKey: string | null };

/** The Bunny settings when the library id and API key are set, else null (video upload is then off). */
export function bunnyConfig(): BunnyConfig | null {
  const { BUNNY_STREAM_LIBRARY_ID: libraryId, BUNNY_STREAM_API_KEY: apiKey, BUNNY_STREAM_TOKEN_KEY: tokenKey, BUNNY_STREAM_READONLY_KEY: readOnlyKey } = serverEnv;
  return libraryId && apiKey ? { libraryId, apiKey, tokenKey: tokenKey ?? null, readOnlyKey: readOnlyKey ?? null } : null;
}

const sha256Hex = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/** Bunny video ids are GUIDs; checked before one goes into a URL or a signature. */
export const BUNNY_VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signature for a browser TUS upload of `videoId`, valid until `expires` (Unix seconds). */
export function uploadSignature(config: Pick<BunnyConfig, "libraryId" | "apiKey">, videoId: string, expires: number): string {
  return sha256Hex(`${config.libraryId}${config.apiKey}${expires}${videoId}`);
}

/**
 * A signed player link for `videoId` that stops working after `expires` (Unix seconds). Without a
 * token key there is no signature: allowed in development only (the library must then have token
 * authentication off); in production that is null, so the video is not shown.
 */
export function playbackUrl(config: Pick<BunnyConfig, "libraryId" | "tokenKey">, videoId: string, expires: number, nodeEnv: string | undefined = process.env.NODE_ENV): string | null {
  if (!BUNNY_VIDEO_ID.test(videoId)) throw new Error("Invalid video id.");
  if (!config.tokenKey) return nodeEnv === "production" ? null : `${PLAYER}/${config.libraryId}/${videoId}`;
  const token = sha256Hex(`${config.tokenKey}${videoId}${expires}`);
  return `${PLAYER}/${config.libraryId}/${videoId}?token=${token}&expires=${expires}`;
}

/** True when `signature` is the HMAC-SHA256 (hex) of the raw webhook body with the read-only key. */
export function verifyWebhookSignature(config: Pick<BunnyConfig, "readOnlyKey">, rawBody: Buffer, signature: string | null): boolean {
  if (!config.readOnlyKey || !signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
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

/**
 * Our lesson video status for the `status` of Bunny's Get Video API, which numbers its states
 * differently from the webhook (bunny.net/docs/reference/video_getvideo, checked 2026-11-04):
 * 0 Created (nothing uploaded yet: no change), 1 Uploaded, 2 Processing, 3 Transcoding,
 * 7 JitSegmenting, 8 JitPlaylistsCreated (processing), 4 Finished (ready), 5 Error, 6 UploadFailed.
 */
export function statusFromVideoApi(status: number): "processing" | "ready" | "failed" | null {
  if (status === 4) return "ready";
  if (status === 5 || status === 6) return "failed";
  if ([1, 2, 3, 7, 8].includes(status)) return "processing";
  return null;
}

/**
 * Asks Bunny how a video is doing (GET /library/{id}/videos/{videoId}). Used while the creator
 * waits, so status updates also work where Bunny's webhook cannot reach (localhost). A missing
 * video counts as failed.
 */
export async function fetchVideoStatus(config: Pick<BunnyConfig, "libraryId" | "apiKey">, videoId: string): Promise<"processing" | "ready" | "failed" | null> {
  return (await fetchVideoInfo(config, videoId))?.status ?? null;
}

/**
 * The video's status and its length in whole seconds (Get Video's `length`, "the duration of the
 * video in seconds", D-098). Null for a bad id or an unknown status.
 */
export async function fetchVideoInfo(config: Pick<BunnyConfig, "libraryId" | "apiKey">, videoId: string): Promise<{ status: "processing" | "ready" | "failed"; lengthSeconds: number | null } | null> {
  if (!BUNNY_VIDEO_ID.test(videoId)) return null;
  const response = await fetch(`${API}/library/${config.libraryId}/videos/${videoId}`, {
    headers: { AccessKey: config.apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return { status: "failed", lengthSeconds: null };
  if (!response.ok) throw new Error(`Bunny get video failed (${response.status}).`);
  const body = (await response.json()) as { status?: unknown; length?: unknown };
  const status = typeof body.status === "number" ? statusFromVideoApi(body.status) : null;
  if (!status) return null;
  const lengthSeconds = typeof body.length === "number" && Number.isFinite(body.length) && body.length >= 0 ? Math.round(body.length) : null;
  return { status, lengthSeconds };
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
