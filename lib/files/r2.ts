import "server-only";

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { serverEnv } from "@/lib/env.server";

// Cloudflare R2 (D-093): the private bucket for product and lesson files, through its S3 API
// (https://developers.cloudflare.com/r2/api/s3/). The bucket has no public access; a file is only
// reached through a short-lived signed link this server makes after its own checks.

type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string };

function r2Config(): R2Config | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = serverEnv;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null;
  return { accountId: R2_ACCOUNT_ID, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET };
}

/** Whether all four R2 variables are set. */
export function r2Configured(): boolean {
  return r2Config() !== null;
}

let cached: { client: S3Client; bucket: string } | null = null;

function r2(): { client: S3Client; bucket: string } {
  if (cached) return cached;
  const config = r2Config();
  if (!config) throw new Error("R2 is not configured.");
  const client = new S3Client({
    region: "auto", // required by the SDK, not used by R2
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // Newer SDK versions add a CRC32 checksum to every upload by default; a browser PUT to a signed
    // link cannot send it, so checksums are only used where an operation requires them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  cached = { client, bucket: config.bucket };
  return cached;
}

/** Seconds a signed upload link stays valid. */
export const R2_UPLOAD_TTL_SECONDS = 10 * 60;
/** Seconds a signed download link stays valid (CLAUDE.md 7: about a minute). */
export const R2_DOWNLOAD_TTL_SECONDS = 60;

/**
 * A signed PUT link for one object. The content type is part of the signature, so the browser must
 * send exactly that type. The size is checked after the upload (`headR2Object`).
 */
export async function r2UploadUrl(key: string, mime: string): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mime }), { expiresIn: R2_UPLOAD_TTL_SECONDS });
}

/** The stored object's size and its first `headBytes` bytes, or null when it is missing. */
export async function inspectR2Object(key: string, headBytes: number): Promise<{ size: number; head: Uint8Array } | null> {
  const { client, bucket } = r2();
  let size: number;
  try {
    const info = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    size = info.ContentLength ?? 0;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  if (size === 0) return { size, head: new Uint8Array() };
  const part = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${headBytes - 1}` }));
  const head = part.Body ? await part.Body.transformToByteArray() : new Uint8Array();
  return { size, head: head.subarray(0, headBytes) };
}

/** A signed GET link that downloads the object under `name` with the stored type. */
export async function r2DownloadUrl(key: string, contentDisposition: string, mime: string): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: contentDisposition, ResponseContentType: mime }), { expiresIn: R2_DOWNLOAD_TTL_SECONDS });
}

export async function removeR2Object(key: string): Promise<void> {
  const { client, bucket } = r2();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

function isMissing(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return error.name === "NotFound" || error.name === "NoSuchKey" || status === 404;
}
