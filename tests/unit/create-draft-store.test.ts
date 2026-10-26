import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { createDraftStore } from "@/lib/stores/create-draft-store";

const insert = vi.fn<(row: Record<string, unknown>) => Promise<{ error: unknown }>>();
const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient;
const ownerId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createDraftStore", () => {
  it("inserts an unpublished-by-default store with the username, the name and USD", async () => {
    insert.mockResolvedValue({ error: null });
    expect(await createDraftStore(client, ownerId, "maya-books", "  Maya Patel ")).toBe("created");
    expect(insert).toHaveBeenCalledWith({ owner_id: ownerId, slug: "maya-books", name: "Maya Patel", currency: "usd" });
  });

  it("cuts the name to the 60-character store name limit and falls back to the username", async () => {
    insert.mockResolvedValue({ error: null });
    await createDraftStore(client, ownerId, "maya", "x".repeat(80));
    expect((insert.mock.calls[0]?.[0] as { name: string }).name).toHaveLength(60);
    await createDraftStore(client, ownerId, "maya", "   ");
    expect((insert.mock.calls[1]?.[0] as { name: string }).name).toBe("maya");
  });

  it("maps the unique constraints: taken username vs already has a store", async () => {
    insert.mockResolvedValueOnce({ error: { code: "23505", message: 'violates unique constraint "stores_slug_key"' } });
    expect(await createDraftStore(client, ownerId, "maya", "Maya")).toBe("taken");
    insert.mockResolvedValueOnce({ error: { code: "23505", message: 'violates unique constraint "stores_owner_id_key"' } });
    expect(await createDraftStore(client, ownerId, "maya", "Maya")).toBe("has_store");
  });

  it("reports other errors without details", async () => {
    insert.mockResolvedValueOnce({ error: { code: "XX000", message: "server at 10.0.0.1 down" } });
    expect(await createDraftStore(client, ownerId, "maya", "Maya")).toBe("error");
  });
});
