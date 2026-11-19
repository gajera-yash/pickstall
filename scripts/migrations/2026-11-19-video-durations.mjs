// Backfill (D-098): lessons.video.durationSeconds for Bunny videos that became ready before
// lengths were saved, so the plan's video hours count them.
//
// The founder runs this; it is never run automatically.
//   Dry run (default, writes nothing):  node --env-file=.env.local scripts/migrations/2026-11-19-video-durations.mjs
//   Apply:                              node --env-file=.env.local scripts/migrations/2026-11-19-video-durations.mjs --apply
//
// It reads each video's `length` ("the duration of the video in seconds") from Bunny's Get Video
// API and writes only `video.durationSeconds` on lessons that have none yet. Safe to run more than
// once. It never deletes anything and prints counts only (no keys, no ids).

import { MongoClient } from "mongodb";

const apply = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "pickstall";
const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
const apiKey = process.env.BUNNY_STREAM_API_KEY;
const VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function out(line) {
  process.stdout.write(`${line}\n`);
}

async function lengthOf(videoId) {
  const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
    headers: { AccessKey: apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body = await response.json();
  return typeof body.length === "number" && Number.isFinite(body.length) && body.length >= 0 ? Math.round(body.length) : null;
}

async function main() {
  if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri)) {
    out("MONGODB_URI is missing or not a mongodb:// URI. Pass --env-file=.env.local.");
    process.exitCode = 1;
    return;
  }
  if (!libraryId || !apiKey) {
    out("BUNNY_STREAM_LIBRARY_ID and BUNNY_STREAM_API_KEY are needed to read video lengths.");
    process.exitCode = 1;
    return;
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const lessons = client.db(dbName).collection("lessons");
    const todo = await lessons.find({ "video.kind": "bunny", "video.status": "ready", "video.durationSeconds": { $exists: false } }, { projection: { "video.videoId": 1 } }).toArray();
    out(`Ready Bunny videos without a length: ${todo.length}`);

    let found = 0;
    let written = 0;
    let missing = 0;
    for (const lesson of todo) {
      const videoId = lesson.video?.videoId;
      if (typeof videoId !== "string" || !VIDEO_ID.test(videoId)) {
        missing += 1;
        continue;
      }
      const seconds = await lengthOf(videoId).catch(() => null);
      if (seconds === null) {
        missing += 1;
        continue;
      }
      found += 1;
      if (apply) {
        const result = await lessons.updateOne({ _id: lesson._id, "video.videoId": videoId, "video.durationSeconds": { $exists: false } }, { $set: { "video.durationSeconds": seconds } });
        written += result.modifiedCount;
      }
    }
    out(`Lengths found: ${found}; not available: ${missing}`);
    out(apply ? `Written: ${written}` : "Dry run: nothing written. Add --apply to write.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  out(`Failed: ${error instanceof Error ? error.name : "error"}`);
  process.exitCode = 1;
});
