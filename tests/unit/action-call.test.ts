import { describe, expect, it, vi } from "vitest";

// A server action called from a page opened before a new deployment (409 "Server Action
// unavailable") shows a message instead of the error page.

class FakeUnrecognized extends Error {}
vi.mock("next/navigation", () => ({ unstable_isUnrecognizedActionError: (error: unknown) => error instanceof FakeUnrecognized }));

import { APP_UPDATED_MESSAGE, OFFLINE_MESSAGE, callAction } from "@/lib/action-call";

describe("callAction", () => {
  it("passes results through", async () => {
    expect(await callAction(async () => ({ ok: true as const, data: 1 }))).toEqual({ ok: true, data: 1 });
  });

  it("asks for a reload after a new deployment, and explains a dropped connection", async () => {
    expect(await callAction(async () => Promise.reject(new FakeUnrecognized("not found")))).toEqual({ ok: false, error: APP_UPDATED_MESSAGE });
    expect(await callAction(async () => Promise.reject(new TypeError("Failed to fetch")))).toEqual({ ok: false, error: OFFLINE_MESSAGE });
  });

  it("rethrows anything else", async () => {
    await expect(callAction(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
  });
});
