import { createHash, createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

// D-055: Bunny Stream signatures and webhook, and YouTube / Vimeo links.

const env = vi.hoisted(() => ({
  serverEnv: {
    BUNNY_STREAM_LIBRARY_ID: "759",
    BUNNY_STREAM_API_KEY: "api-key-123",
    BUNNY_STREAM_TOKEN_KEY: "token-key-456",
    BUNNY_STREAM_READONLY_KEY: "readonly-key-789",
  } as Record<string, string | undefined>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => env);
const db = vi.hoisted(() => ({ webhookEvents: { insertOne: vi.fn(), deleteOne: vi.fn() } }));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: (error: unknown) => (error as { code?: number })?.code === 11000 }));
const curriculum = vi.hoisted(() => ({ setBunnyVideoStatus: vi.fn() }));
vi.mock("@/lib/courses/curriculum", () => curriculum);
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { handleBunnyWebhook } from "@/lib/courses/bunny-webhook";
import { embedUrlFor, parseVideoLink, watchUrlFor } from "@/lib/courses/video-links";
import { bunnyConfig, playbackUrl, statusFromWebhook, uploadSignature, verifyWebhookSignature } from "@/lib/video/bunny";

const VIDEO = "eb1c4f77-0cda-46be-b47d-1118ad7c2ffe";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

describe("Bunny signing", () => {
  const config = bunnyConfig()!;

  it("reads all four settings, and is off when one is missing", () => {
    expect(config).toEqual({ libraryId: "759", apiKey: "api-key-123", tokenKey: "token-key-456", readOnlyKey: "readonly-key-789" });
    const saved = env.serverEnv.BUNNY_STREAM_TOKEN_KEY;
    env.serverEnv.BUNNY_STREAM_TOKEN_KEY = undefined;
    expect(bunnyConfig()).toBeNull();
    env.serverEnv.BUNNY_STREAM_TOKEN_KEY = saved;
  });

  it("signs a TUS upload as SHA256(libraryId + apiKey + expires + videoId)", () => {
    expect(uploadSignature(config, VIDEO, 1_800_000_000)).toBe(sha(`759api-key-123${1_800_000_000}${VIDEO}`));
  });

  it("signs a player link as SHA256(tokenKey + videoId + expires)", () => {
    expect(playbackUrl(config, VIDEO, 1_456_761_770)).toBe(`https://player.mediadelivery.net/embed/759/${VIDEO}?token=${sha(`token-key-456${VIDEO}1456761770`)}&expires=1456761770`);
    expect(() => playbackUrl(config, "../../evil", 1)).toThrow();
  });

  it("accepts only the HMAC of the exact raw body", () => {
    const body = Buffer.from('{"VideoGuid":"x"}');
    const good = createHmac("sha256", "readonly-key-789").update(body).digest("hex");
    expect(verifyWebhookSignature(config, body, good)).toBe(true);
    expect(verifyWebhookSignature(config, body, good.toUpperCase())).toBe(true);
    expect(verifyWebhookSignature(config, Buffer.from('{"VideoGuid":"y"}'), good)).toBe(false);
    expect(verifyWebhookSignature(config, body, createHmac("sha256", "api-key-123").update(body).digest("hex"))).toBe(false);
    expect(verifyWebhookSignature(config, body, null)).toBe(false);
    expect(verifyWebhookSignature(config, body, "abc")).toBe(false);
  });

  it("maps Bunny statuses", () => {
    expect(statusFromWebhook(3)).toBe("ready");
    expect(statusFromWebhook(5)).toBe("failed");
    expect(statusFromWebhook(8)).toBe("failed");
    expect(statusFromWebhook(2)).toBe("processing");
    expect(statusFromWebhook(9)).toBeNull();
  });
});

describe("Bunny webhook", () => {
  const send = (body: Record<string, unknown>, key = "readonly-key-789") => {
    const raw = Buffer.from(JSON.stringify(body));
    return handleBunnyWebhook(raw, createHmac("sha256", key).update(raw).digest("hex"));
  };
  const event = { IsLiveStreamWebhook: false, VideoLibraryId: 759, VideoGuid: VIDEO, Status: 3, EventId: "evt-1", Timestamp: "2026-11-04T12:00:00Z" };

  beforeEach(() => {
    vi.clearAllMocks();
    db.webhookEvents.insertOne.mockResolvedValue({});
    db.webhookEvents.deleteOne.mockResolvedValue({});
    curriculum.setBunnyVideoStatus.mockResolvedValue(1);
  });

  it("refuses a bad signature without touching the database", async () => {
    expect((await send(event, "wrong-key")).status).toBe(401);
    expect(db.webhookEvents.insertOne).not.toHaveBeenCalled();
  });

  it("records the event, then marks the video ready", async () => {
    expect((await send(event)).status).toBe(200);
    expect(db.webhookEvents.insertOne).toHaveBeenCalledWith(expect.objectContaining({ _id: "bunny:evt-1", source: "bunny" }));
    expect(curriculum.setBunnyVideoStatus).toHaveBeenCalledWith(VIDEO, "ready");
  });

  it("does nothing for a redelivered event", async () => {
    db.webhookEvents.insertOne.mockRejectedValue({ code: 11000 });
    expect((await send(event)).status).toBe(200);
    expect(curriculum.setBunnyVideoStatus).not.toHaveBeenCalled();
  });

  it("ignores another library and statuses we do not use", async () => {
    expect((await send({ ...event, VideoLibraryId: 1 })).status).toBe(200);
    expect((await send({ ...event, Status: 9 })).status).toBe(200);
    expect(curriculum.setBunnyVideoStatus).not.toHaveBeenCalled();
  });

  it("refuses a malformed payload", async () => {
    expect((await send({ ...event, VideoGuid: "../x" })).status).toBe(400);
  });

  it("forgets the event and asks for a retry when the update fails", async () => {
    curriculum.setBunnyVideoStatus.mockRejectedValue(new Error("db down"));
    expect((await send(event)).status).toBe(500);
    expect(db.webhookEvents.deleteOne).toHaveBeenCalledWith({ _id: "bunny:evt-1" });
  });
});

describe("YouTube and Vimeo links", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", { kind: "youtube", id: "dQw4w9WgXcQ" }],
    ["https://youtu.be/dQw4w9WgXcQ?t=30", { kind: "youtube", id: "dQw4w9WgXcQ" }],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", { kind: "youtube", id: "dQw4w9WgXcQ" }],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", { kind: "youtube", id: "dQw4w9WgXcQ" }],
    ["https://vimeo.com/76979871", { kind: "vimeo", id: "76979871", hash: null }],
    ["https://vimeo.com/76979871/abc123def4", { kind: "vimeo", id: "76979871", hash: "abc123def4" }],
    ["https://player.vimeo.com/video/76979871?h=ABC123DEF4", { kind: "vimeo", id: "76979871", hash: "abc123def4" }],
  ])("reads %s", (link, expected) => {
    expect(parseVideoLink(link)).toEqual(expected);
  });

  it.each([
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)",
    "https://www.youtube.com/watch?v=short",
    "https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ",
    "https://vimeo.com/channels/staff",
    "not a link",
  ])("refuses %s", (link) => {
    expect(parseVideoLink(link)).toBeNull();
  });

  it("builds the player link only from the id", () => {
    expect(embedUrlFor({ kind: "youtube", id: "dQw4w9WgXcQ" })).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(embedUrlFor({ kind: "vimeo", id: "76979871", hash: "abc123def4" })).toBe("https://player.vimeo.com/video/76979871?h=abc123def4");
    expect(() => embedUrlFor({ kind: "youtube", id: "x/../../evil" })).toThrow();
    expect(watchUrlFor({ kind: "vimeo", id: "76979871", hash: null })).toBe("https://vimeo.com/76979871");
  });
});
