import { beforeEach, describe, expect, it, vi } from "vitest";

import { formData, redirectOf, supabase } from "./auth-mocks";

import { createStore } from "@/lib/stores/actions";

const userId = "11111111-1111-4111-8111-111111111111";
const claims = { sub: userId, email: "maya@example.com" };

function mockInsert(error: unknown = null) {
  const insert = vi.fn<(row: Record<string, unknown>) => Promise<{ error: unknown }>>(async () => ({ error }));
  supabase.from.mockReturnValue({ insert });
  return insert;
}

const form = (overrides: Record<string, string> = {}) =>
  formData({ name: "Maya's Budget Studio", username: "Maya-Books", currency: "gbp", bio: " Plans for money. ", ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  supabase.auth.getClaims.mockResolvedValue({ data: { claims }, error: null });
});

describe("createStore", () => {
  it("sends a signed-out visitor to login without touching the database", async () => {
    supabase.auth.getClaims.mockResolvedValue({ data: null, error: null });
    expect(await redirectOf(() => createStore(null, form()))).toBe("/login?next=%2Fonboarding");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it.each([
    ["empty store name", { name: "  " }, "name", "Enter a store name."],
    ["reserved username", { username: "dashboard" }, "username", "That username is taken. Try another."],
    ["short username", { username: "ab" }, "username", "Use 3 to 30 characters."],
    ["unknown currency", { currency: "eur" }, "currency", "Choose a currency."],
    ["long bio", { bio: "x".repeat(201) }, "bio", "Use 200 characters or fewer."],
  ])("rejects %s with the field name", async (_label, override, field, message) => {
    expect(await createStore(null, form(override))).toEqual({ ok: false, error: message, field });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("creates the store for the verified user and goes to the activation step", async () => {
    const insert = mockInsert();
    expect(await redirectOf(() => createStore(null, form()))).toBe("/onboarding/activate");
    expect(supabase.from).toHaveBeenCalledWith("stores");
    expect(insert).toHaveBeenCalledWith({
      owner_id: userId,
      slug: "maya-books",
      name: "Maya's Budget Studio",
      currency: "gbp",
      bio: "Plans for money.",
    });
  });

  it("stores no bio when it is empty", async () => {
    const insert = mockInsert();
    await redirectOf(() => createStore(null, form({ bio: "" })));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ bio: null }));
  });

  it("ignores an owner id sent in the form (no creating stores for someone else)", async () => {
    const insert = mockInsert();
    const tampered = form();
    tampered.set("owner_id", "99999999-9999-4999-8999-999999999999");
    tampered.set("stripe_charges_enabled", "true");
    await redirectOf(() => createStore(null, tampered));
    const row = insert.mock.calls[0]?.[0] ?? {};
    expect(row.owner_id).toBe(userId);
    expect(row).not.toHaveProperty("stripe_charges_enabled");
    expect(Object.keys(row).sort()).toEqual(["bio", "currency", "name", "owner_id", "slug"]);
  });

  it("reports a taken username on the username field", async () => {
    mockInsert({ code: "23505", message: 'duplicate key value violates unique constraint "stores_slug_key"' });
    expect(await createStore(null, form())).toEqual({
      ok: false,
      error: "That username is taken. Try another.",
      field: "username",
    });
  });

  it("goes on to the dashboard when the user already has a store", async () => {
    mockInsert({ code: "23505", message: 'duplicate key value violates unique constraint "stores_owner_id_key"' });
    expect(await redirectOf(() => createStore(null, form()))).toBe("/dashboard");
  });

  it("hides database details on other errors", async () => {
    mockInsert({ code: "XX000", message: "connection to server at 10.0.0.1 failed" });
    const result = await createStore(null, form());
    expect(result).toEqual({ ok: false, error: "Couldn't create your store. Check your connection and try again." });
    expect(JSON.stringify(result)).not.toContain("10.0.0.1");
  });
});
