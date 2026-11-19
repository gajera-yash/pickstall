import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ subscribers: { find: vi.fn(), bulkWrite: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: () => false }));
vi.mock("@/lib/subscribers/welcome", () => ({ sendWelcomeEmail: vi.fn() }));

import { productsCsv } from "@/lib/products/export";
import { cleanImportRow, guessColumn, importConsentText, importPayload, parseCsv } from "@/lib/subscribers/import-rules";
import { importSubscribers } from "@/lib/subscribers/queries";

describe("CSV parsing for imports (D-100)", () => {
  it("reads quoted cells, escaped quotes, CRLF, a BOM and skips empty lines", () => {
    const text = '﻿Email,Name\r\n"asha@example.com","Patel, Asha"\r\n\r\nbob@example.com,"Bob ""B"" Lee"\nlast@example.com,Last';
    expect(parseCsv(text)).toEqual([
      ["Email", "Name"],
      ["asha@example.com", "Patel, Asha"],
      ["bob@example.com", 'Bob "B" Lee'],
      ["last@example.com", "Last"],
    ]);
  });

  it("stops at the row cap", () => {
    expect(parseCsv("a\n1\n2\n3\n4", 3)).toHaveLength(3);
  });

  it("guesses the email and name columns from the header", () => {
    expect(guessColumn(["First Name", "Email Address", "Joined"], "email")).toBe(1);
    expect(guessColumn(["First Name", "Email Address", "Joined"], "name")).toBe(0);
    expect(guessColumn(["Customer email", "Full name"], "name")).toBe(1);
    expect(guessColumn(["a", "b"], "email")).toBe(-1);
  });

  it("keeps only valid emails and cleans names", () => {
    expect(cleanImportRow({ email: " asha@example.com ", name: "<b>Asha</b>  Patel" })).toEqual({ email: "asha@example.com", name: "Asha Patel" });
    expect(cleanImportRow({ email: "not-an-email", name: "x" })).toBeNull();
    expect(cleanImportRow({ email: 42, name: "x" })).toBeNull();
    expect(cleanImportRow({ email: "a@b.co", name: undefined })).toEqual({ email: "a@b.co", name: null });
  });

  it("requires the creator's consent confirmation and caps the rows", () => {
    expect(importPayload.safeParse({ fileName: "list.csv", consent: false, rows: [{ email: "a@b.co", name: "" }] }).success).toBe(false);
    expect(importPayload.safeParse({ fileName: "list.csv", consent: true, rows: [] }).success).toBe(false);
    expect(importPayload.safeParse({ fileName: "list.csv", consent: true, rows: Array.from({ length: 10_001 }, () => ({ email: "a@b.co", name: "" })) }).success).toBe(false);
    expect(importConsentText("<i>stan</i>.csv", new Date("2026-11-19T10:00:00Z"))).toBe("Imported by the creator from stan.csv on 2026-11-19. The creator confirmed these people agreed to get their emails.");
  });
});

describe("importing subscribers (D-100)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.subscribers.find.mockReturnValue({ toArray: async () => [{ emailKey: "old@example.com" }] });
    db.subscribers.bulkWrite.mockImplementation(async (ops: unknown[]) => ({ upsertedCount: ops.length }));
  });

  const rows = [
    { email: "new@example.com", name: "New" },
    { email: "OLD@example.com", name: "Old" },
    { email: "new@example.com", name: "Duplicate in file" },
    { email: "bad", name: "Bad" },
    { email: "two@example.com", name: "" },
  ];

  it("adds only valid, new emails of the session's store, never touching people already on the list", async () => {
    const result = await importSubscribers("store-a", rows, { consentText: "consent", fileName: "list.csv", room: 100, now: new Date("2026-11-19T10:00:00Z") });
    expect(result).toEqual({ added: 2, existing: 1, invalid: 1, overLimit: 0 });
    expect(db.subscribers.find).toHaveBeenCalledWith({ storeId: "store-a", emailKey: { $in: ["new@example.com", "old@example.com", "two@example.com"] } }, expect.anything());
    const ops = db.subscribers.bulkWrite.mock.calls[0]![0] as { updateOne: { filter: unknown; update: { $setOnInsert: Record<string, unknown>; $set?: unknown }; upsert: boolean } }[];
    expect(ops).toHaveLength(2);
    expect(ops[0]!.updateOne.filter).toEqual({ storeId: "store-a", emailKey: "new@example.com" });
    expect(ops[0]!.updateOne.update.$set).toBeUndefined();
    expect(ops[0]!.updateOne.update.$setOnInsert).toMatchObject({ storeId: "store-a", status: "subscribed", source: { kind: "import", productId: "", productTitle: "list.csv" }, consent: { text: "consent" } });
    expect(ops[0]!.updateOne.update.$setOnInsert.unsubscribeToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("adds no more than the plan's room", async () => {
    const result = await importSubscribers("store-a", rows, { consentText: "consent", fileName: "list.csv", room: 1 });
    expect(result).toMatchObject({ added: 1, overLimit: 1 });
    expect(await importSubscribers("store-a", rows, { consentText: "consent", fileName: "list.csv", room: -5 })).toMatchObject({ added: 0, overLimit: 2 });
  });
});

describe("products CSV (D-100)", () => {
  it("has public fields only, a link for published products, and neutralized formulas", () => {
    const csv = productsCsv(
      [
        { title: "=cmd()", type: "digital", status: "published", slug: "guide", priceCents: 1900, salePriceCents: 900, createdAt: new Date("2026-11-19T10:00:00Z") },
        { title: "Draft", type: "lead_magnet", status: "draft", slug: "free", priceCents: 0, salePriceCents: null, createdAt: new Date("2026-11-19T10:00:00Z") },
      ],
      { slug: "maya", currency: "usd" },
    );
    expect(csv).toContain(`"'=cmd()"`);
    expect(csv).toContain("/@maya/guide");
    expect(csv).toContain('"Collect emails","draft","Free"');
    expect(csv).not.toContain("externalUrl");
  });
});
