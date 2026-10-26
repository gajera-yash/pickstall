import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteUsersById,
  expectDenied,
  expectNoRows,
  must,
  runId,
  sweepLeftoverTestData,
  testEmail,
  type TestUser,
} from "./helpers";

// Cross-tenant RLS tests (CLAUDE.md sections 6 and 10, PHASE1_PLAN Block A step 5).
// Runs only against the hosted DEV project (tests/db/guard.ts).
//
// Fixture:
//   creator A: published store, one published + one draft product, one file
//   creator B: unpublished store, one published product, one file
//   buyer: one paid order + enrollment in each store (written by the service role)

type Row = { id: string };

const admin = adminClient();
const anon = anonClient();

let a: TestUser;
let b: TestUser;
let buyer: TestUser;
let phoneUser: TestUser;
let badPhoneUser: TestUser;

let storeA: Row;
let storeB: Row;
let productA: Row;
let draftA: Row;
let productB: Row;
let fileA: Row;
let fileB: Row;
let orderA: Row;
let orderB: Row;
let itemA: Row;
let itemB: Row;
let enrollmentA: Row;
let enrollmentB: Row;
let emailLog: Row;
const webhookEventId = `evt_rls_${runId}`;

beforeAll(async () => {
  await sweepLeftoverTestData(admin);

  a = await createTestUser(admin, "creator-a");
  b = await createTestUser(admin, "creator-b");
  buyer = await createTestUser(admin, "buyer");
  phoneUser = await createTestUser(admin, "phone", { full_name: "Example Phone", phone: "+14155550100" });
  badPhoneUser = await createTestUser(admin, "badphone", { full_name: "x".repeat(200), phone: "12345; drop table" });

  // Creators set up their own data through their own (RLS-limited) clients.
  storeA = must(
    await a.client
      .from("stores")
      .insert({ owner_id: a.id, slug: `rls-${runId}-a`, name: "Example store A" })
      .select("id")
      .single(),
    "insert store A",
  ) as Row;
  must(
    await a.client.from("stores").update({ is_published: true }).eq("id", storeA.id).select("id"),
    "publish store A",
  );
  storeB = must(
    await b.client
      .from("stores")
      .insert({ owner_id: b.id, slug: `rls-${runId}-b`, name: "Example store B" })
      .select("id")
      .single(),
    "insert store B",
  ) as Row;

  productA = must(
    await a.client
      .from("products")
      .insert({
        store_id: storeA.id,
        title: "Example A",
        slug: "example-a",
        price_cents: 1000,
        status: "published",
        external_url: "https://example.test/a",
      })
      .select("id")
      .single(),
    "insert product A",
  ) as Row;
  draftA = must(
    await a.client
      .from("products")
      .insert({ store_id: storeA.id, title: "Example draft", slug: "example-draft", price_cents: 500 })
      .select("id")
      .single(),
    "insert draft A",
  ) as Row;
  productB = must(
    await b.client
      .from("products")
      .insert({
        store_id: storeB.id,
        title: "Example B",
        slug: "example-b",
        price_cents: 2000,
        status: "published",
        external_url: "https://example.test/b",
      })
      .select("id")
      .single(),
    "insert product B",
  ) as Row;

  fileA = must(
    await a.client
      .from("product_files")
      .insert({ product_id: productA.id, storage_path: `rls/${runId}/a.pdf`, file_name: "a.pdf", size_bytes: 10 })
      .select("id")
      .single(),
    "insert file A",
  ) as Row;
  fileB = must(
    await b.client
      .from("product_files")
      .insert({ product_id: productB.id, storage_path: `rls/${runId}/b.pdf`, file_name: "b.pdf", size_bytes: 10 })
      .select("id")
      .single(),
    "insert file B",
  ) as Row;

  // Sales data is written only by the service role, as the webhook will do.
  const order = async (storeId: string, productId: string, cents: number) => {
    const o = must(
      await admin
        .from("orders")
        .insert({
          store_id: storeId,
          buyer_user_id: buyer.id,
          buyer_email: buyer.email,
          status: "paid",
          subtotal_cents: cents,
          total_cents: cents,
          currency: "usd",
        })
        .select("id")
        .single(),
      "insert order",
    ) as Row;
    const item = must(
      await admin
        .from("order_items")
        .insert({ order_id: o.id, product_id: productId, unit_price_cents: cents })
        .select("id")
        .single(),
      "insert order item",
    ) as Row;
    const enrollment = must(
      await admin
        .from("enrollments")
        .insert({ user_id: buyer.id, product_id: productId, order_id: o.id })
        .select("id")
        .single(),
      "insert enrollment",
    ) as Row;
    return { o, item, enrollment };
  };
  ({ o: orderA, item: itemA, enrollment: enrollmentA } = await order(storeA.id, productA.id, 1000));
  ({ o: orderB, item: itemB, enrollment: enrollmentB } = await order(storeB.id, productB.id, 2000));

  must(
    await admin
      .from("webhook_events")
      .insert({ id: webhookEventId, source: "stripe-connect", type: "test.rls", payload: {} })
      .select("id"),
    "insert webhook event",
  );
  emailLog = must(
    await admin
      .from("email_log")
      .insert({ store_id: storeA.id, to_email: testEmail("log"), template: "test" })
      .select("id")
      .single(),
    "insert email log",
  ) as Row;
});

afterAll(async () => {
  await admin.from("webhook_events").delete().eq("id", webhookEventId);
  if (emailLog) await admin.from("email_log").delete().eq("id", emailLog.id);
  await deleteUsersById(
    admin,
    [a, b, buyer, phoneUser, badPhoneUser].filter(Boolean).map((user) => user.id),
  );
});

const ids = (data: unknown) => ((data ?? []) as Row[]).map((row) => row.id).sort();

describe("profiles and roles", () => {
  it("creates a profile for every new user", async () => {
    const { data } = await admin.from("profiles").select("id, email").in("id", [a.id, b.id, buyer.id]);
    expect(ids(data)).toEqual([a.id, b.id, buyer.id].sort());
  });

  it("marks store owners as creators and leaves buyers as buyers", async () => {
    const { data } = await admin.from("profiles").select("id, role").in("id", [a.id, buyer.id]);
    const roles = Object.fromEntries(((data ?? []) as { id: string; role: string }[]).map((p) => [p.id, p.role]));
    expect(roles[a.id]).toBe("creator");
    expect(roles[buyer.id]).toBe("buyer");
  });

  it("lets a user read only their own profile", async () => {
    const { data, error } = await a.client.from("profiles").select("id");
    expect(error).toBeNull();
    expect(ids(data)).toEqual([a.id]);
  });

  it("copies a well-formed phone number from the sign-up metadata", async () => {
    const { data } = await admin.from("profiles").select("full_name, phone").eq("id", phoneUser.id).single();
    expect(data).toEqual({ full_name: "Example Phone", phone: "+14155550100" });
  });

  it("drops a malformed phone number and caps the name length instead of failing sign-in", async () => {
    const { data } = await admin.from("profiles").select("full_name, phone").eq("id", badPhoneUser.id).single();
    const profile = data as { full_name: string; phone: string | null };
    expect(profile.phone).toBeNull();
    expect(profile.full_name).toHaveLength(80);
  });

  it("lets a user set their own phone number, in international format only", async () => {
    const own = await badPhoneUser.client
      .from("profiles")
      .update({ phone: "+14155550199" })
      .eq("id", badPhoneUser.id)
      .select("phone");
    expect(own.error).toBeNull();
    expect(own.data).toEqual([{ phone: "+14155550199" }]);
    const malformed = await badPhoneUser.client.from("profiles").update({ phone: "12345" }).eq("id", badPhoneUser.id);
    expect(malformed.error?.code).toBe("23514");
  });

  it("does not let a user change someone else's phone number", async () => {
    expectNoRows(await buyer.client.from("profiles").update({ phone: "+14155550111" }).eq("id", phoneUser.id).select("id"));
    const { data } = await admin.from("profiles").select("phone").eq("id", phoneUser.id).single();
    expect((data as { phone: string }).phone).toBe("+14155550100");
  });

  it("lets a user read their own phone number but not anyone else's", async () => {
    const own = await phoneUser.client.from("profiles").select("phone").eq("id", phoneUser.id).single();
    expect((own.data as { phone: string }).phone).toBe("+14155550100");
    expectNoRows(await buyer.client.from("profiles").select("phone").eq("id", phoneUser.id));
    expectDenied(await anon.from("profiles").select("phone"));
  });

  it("lets a user change their own display name", async () => {
    const { data, error } = await a.client.from("profiles").update({ full_name: "Example A" }).eq("id", a.id).select("id");
    expect(error).toBeNull();
    expect(ids(data)).toEqual([a.id]);
  });

  it("does not let a user change their own role", async () => {
    expectDenied(await buyer.client.from("profiles").update({ role: "creator" }).eq("id", buyer.id));
    const { data } = await admin.from("profiles").select("role").eq("id", buyer.id).single();
    expect((data as { role: string }).role).toBe("buyer");
  });

  it("does not let a user edit someone else's profile", async () => {
    expectNoRows(await a.client.from("profiles").update({ full_name: "hacked" }).eq("id", b.id).select("id"));
  });
});

describe("stores", () => {
  it("shows a creator only their own store", async () => {
    const { data, error } = await a.client.from("stores").select("id");
    expect(error).toBeNull();
    expect(ids(data)).toEqual([storeA.id]);
  });

  it("does not let creator A read or edit creator B's store", async () => {
    expectNoRows(await a.client.from("stores").select("id").eq("id", storeB.id));
    expectNoRows(await a.client.from("stores").update({ name: "hacked" }).eq("id", storeB.id).select("id"));
    const { data } = await admin.from("stores").select("name").eq("id", storeB.id).single();
    expect((data as { name: string }).name).toBe("Example store B");
  });

  it.each([
    ["stripe_charges_enabled", true],
    ["stripe_account_id", "acct_fake"],
    ["custom_domain", "fake.example.test"],
  ])("does not let a creator set %s on their own store", async (column, value) => {
    expectDenied(await a.client.from("stores").update({ [column]: value }).eq("id", storeA.id));
  });

  it("keeps the Stripe fields untouched after those attempts", async () => {
    const { data } = await admin
      .from("stores")
      .select("stripe_charges_enabled, stripe_account_id, custom_domain")
      .eq("id", storeA.id)
      .single();
    expect(data).toEqual({ stripe_charges_enabled: false, stripe_account_id: null, custom_domain: null });
  });

  it("does not let a creator hand their store to someone else", async () => {
    expectDenied(await a.client.from("stores").update({ owner_id: b.id }).eq("id", storeA.id));
  });

  it("does not let a creator delete their store from the client", async () => {
    expectDenied(await a.client.from("stores").delete().eq("id", storeA.id));
  });

  it("allows only one store per creator", async () => {
    const result = await a.client.from("stores").insert({ owner_id: a.id, slug: `rls-${runId}-a2`, name: "Second" });
    expect(result.error?.code).toBe("23505");
  });

  it("does not let a user create a store for someone else", async () => {
    expectDenied(await buyer.client.from("stores").insert({ owner_id: a.id, slug: `rls-${runId}-x`, name: "Fake" }));
  });

  it("does not let a user create a store that claims Stripe is connected", async () => {
    expectDenied(
      await buyer.client
        .from("stores")
        .insert({ owner_id: buyer.id, slug: `rls-${runId}-y`, name: "Fake", stripe_charges_enabled: true }),
    );
  });
});

describe("products and files", () => {
  it("does not let creator A read creator B's products or files", async () => {
    expectNoRows(await a.client.from("products").select("id").eq("store_id", storeB.id));
    expectNoRows(await a.client.from("product_files").select("id").eq("id", fileB.id));
  });

  it("does not let creator A edit or delete creator B's product", async () => {
    expectNoRows(await a.client.from("products").update({ title: "hacked" }).eq("id", productB.id).select("id"));
    expectNoRows(await a.client.from("products").delete().eq("id", productB.id).select("id"));
    const { data } = await admin.from("products").select("title").eq("id", productB.id).single();
    expect((data as { title: string }).title).toBe("Example B");
  });

  it("does not let creator A add a product or file to creator B's store", async () => {
    expectDenied(
      await a.client.from("products").insert({ store_id: storeB.id, title: "Fake", slug: "fake", price_cents: 1 }),
    );
    expectDenied(
      await a.client
        .from("product_files")
        .insert({ product_id: productB.id, storage_path: "x", file_name: "x", size_bytes: 1 }),
    );
  });

  it("does not let creator A move a product into creator B's store", async () => {
    expectDenied(await a.client.from("products").update({ store_id: storeB.id }).eq("id", productA.id));
  });

  it("lets a creator manage their own products and files", async () => {
    const products = await a.client.from("products").select("id").eq("store_id", storeA.id);
    expect(ids(products.data)).toEqual([productA.id, draftA.id].sort());
    const files = await a.client.from("product_files").select("id");
    expect(ids(files.data)).toEqual([fileA.id]);
  });

  it("does not let a creator delete a product that has sales", async () => {
    const result = await a.client.from("products").delete().eq("id", productA.id);
    expect(result.error?.code).toBe("23503");
    const { data } = await admin.from("products").select("id").eq("id", productA.id);
    expect(ids(data)).toEqual([productA.id]);
  });

  it("requires a minimum price for pay-what-you-want products", async () => {
    const result = await a.client
      .from("products")
      .insert({ store_id: storeA.id, title: "PWYW", slug: "pwyw", price_cents: 0, pricing_model: "pwyw" });
    expect(result.error?.code).toBe("23514");
  });
});

describe("sales data", () => {
  it("shows each creator only their own orders, items and enrollments", async () => {
    expect(ids((await a.client.from("orders").select("id")).data)).toEqual([orderA.id]);
    expect(ids((await a.client.from("order_items").select("id")).data)).toEqual([itemA.id]);
    expect(ids((await a.client.from("enrollments").select("id")).data)).toEqual([enrollmentA.id]);
    expect(ids((await b.client.from("orders").select("id")).data)).toEqual([orderB.id]);
  });

  it("shows a buyer their own orders and enrollments", async () => {
    expect(ids((await buyer.client.from("orders").select("id")).data)).toEqual([orderA.id, orderB.id].sort());
    expect(ids((await buyer.client.from("order_items").select("id")).data)).toEqual([itemA.id, itemB.id].sort());
    expect(ids((await buyer.client.from("enrollments").select("id")).data)).toEqual(
      [enrollmentA.id, enrollmentB.id].sort(),
    );
  });

  it("does not let creators write orders, items or enrollments", async () => {
    expectDenied(
      await a.client.from("orders").insert({
        store_id: storeA.id,
        buyer_email: "x@example.test",
        subtotal_cents: 1,
        total_cents: 1,
        currency: "usd",
      }),
    );
    expectDenied(await a.client.from("orders").update({ status: "refunded" }).eq("id", orderA.id));
    expectDenied(await a.client.from("order_items").insert({ order_id: orderA.id, product_id: productA.id, unit_price_cents: 0 }));
    expectDenied(await a.client.from("enrollments").insert({ user_id: a.id, product_id: productA.id }));
    expectDenied(await a.client.from("enrollments").update({ revoked_at: new Date().toISOString() }).eq("id", enrollmentA.id));
  });

  it("does not let a buyer grant themselves access or reset their download count", async () => {
    expectDenied(await buyer.client.from("enrollments").insert({ user_id: buyer.id, product_id: draftA.id }));
    expectDenied(await buyer.client.from("enrollments").update({ download_count: 0 }).eq("id", enrollmentA.id));
  });
});

describe("service-only tables", () => {
  it.each(["webhook_events", "email_log"])("denies %s to signed-in users and anonymous visitors", async (table) => {
    expectDenied(await a.client.from(table).select("id"));
    expectDenied(await anon.from(table).select("id"));
  });
});

describe("anonymous visitors", () => {
  it.each(["profiles", "stores", "products", "product_files", "orders", "order_items", "enrollments"])(
    "cannot read the %s table",
    async (table) => {
      expectDenied(await anon.from(table).select("id"));
    },
  );

  it("see only published stores, without private columns", async () => {
    const { data, error } = await anon.from("public_stores").select("*").in("id", [storeA.id, storeB.id]);
    expect(error).toBeNull();
    expect(ids(data)).toEqual([storeA.id]);
    const store = (data as Record<string, unknown>[])[0] ?? {};
    expect(store).toHaveProperty("can_accept_payments", false);
    expect(store).not.toHaveProperty("stripe_account_id");
    expect(store).not.toHaveProperty("owner_id");
    expect(store).not.toHaveProperty("custom_domain");
  });

  it("cannot ask the public view for the Stripe account id", async () => {
    const result = await anon.from("public_stores").select("stripe_account_id");
    expect(result.error).not.toBeNull();
  });

  it("see only published products of published stores", async () => {
    const { data, error } = await anon.from("public_products").select("id").in("store_id", [storeA.id, storeB.id]);
    expect(error).toBeNull();
    expect(ids(data)).toEqual([productA.id]);
  });

  it("cannot write through the public views", async () => {
    expectDenied(await anon.from("public_stores").update({ name: "hacked" }).eq("id", storeA.id));
    expectDenied(await anon.from("public_stores").delete().eq("id", storeA.id));
    expectDenied(await anon.from("public_products").insert({ title: "Fake" }));
    expectDenied(await a.client.from("public_stores").update({ name: "hacked" }).eq("id", storeB.id));
  });
});

describe("signup intents (service role only)", () => {
  const intentEmail = testEmail("intent");

  beforeAll(async () => {
    must(
      await admin
        .from("signup_intents")
        .insert({
          email: intentEmail,
          username: `rls-${runId}-intent`,
          full_name: "Example Intent",
          token_hash: "a".repeat(64),
        })
        .select("id"),
      "insert signup intent",
    );
  });

  afterAll(async () => {
    await admin.from("signup_intents").delete().eq("email", intentEmail);
  });

  it("is readable by the service role", async () => {
    const { data } = await admin.from("signup_intents").select("email").eq("email", intentEmail);
    expect(data).toEqual([{ email: intentEmail }]);
  });

  it("cannot be read or written by signed-in users or anonymous visitors", async () => {
    expectDenied(await a.client.from("signup_intents").select("id"));
    expectDenied(await anon.from("signup_intents").select("id"));
    const row = { email: testEmail("intent2"), username: "fake-name", full_name: "Fake", token_hash: "b".repeat(64) };
    expectDenied(await a.client.from("signup_intents").insert(row));
    expectDenied(await anon.from("signup_intents").insert(row));
    expectDenied(await anon.from("signup_intents").delete().eq("email", intentEmail));
  });

  it("checks its columns", async () => {
    const bad = await admin
      .from("signup_intents")
      .insert({ email: "Upper@Example.test", username: "ok-name", full_name: "x", token_hash: "short" });
    expect(bad.error?.code).toBe("23514");
  });
});

describe("draft store at signup and the username race", () => {
  const raceSlug = `rls-${runId}-race`;

  it("creates a draft store with the user's own session and makes them a creator", async () => {
    const created = await phoneUser.client
      .from("stores")
      .insert({ owner_id: phoneUser.id, slug: raceSlug, name: "Example Phone", currency: "usd" })
      .select("is_published")
      .single();
    expect(created.error).toBeNull();
    expect(created.data).toEqual({ is_published: false });
    const { data } = await admin.from("profiles").select("role").eq("id", phoneUser.id).single();
    expect((data as { role: string }).role).toBe("creator");
  });

  it("lets the unique slug decide a race: the second user gets 23505 and stays a buyer", async () => {
    const second = await badPhoneUser.client
      .from("stores")
      .insert({ owner_id: badPhoneUser.id, slug: raceSlug, name: "Other", currency: "usd" });
    expect(second.error?.code).toBe("23505");
    const { data } = await admin.from("profiles").select("role").eq("id", badPhoneUser.id).single();
    expect((data as { role: string }).role).toBe("buyer");
    const stores = await admin.from("stores").select("id").eq("owner_id", badPhoneUser.id);
    expect(stores.data).toEqual([]);
  });
});

describe("external links and the publish rule", () => {
  it("rejects a link that is not https", async () => {
    const result = await a.client
      .from("products")
      .insert({ store_id: storeA.id, title: "Plain http", slug: "plain-http", price_cents: 100, external_url: "http://example.test" });
    expect(result.error?.code).toBe("23514");
  });

  it("lets the owner read the link, but never exposes it publicly", async () => {
    const own = await a.client.from("products").select("external_url").eq("id", productA.id).single();
    expect((own.data as { external_url: string }).external_url).toBe("https://example.test/a");
    expectNoRows(await b.client.from("products").select("external_url").eq("id", productA.id));
    expect((await anon.from("public_products").select("external_url")).error).not.toBeNull();
    const { data } = await anon.from("public_products").select("*").eq("id", productA.id);
    expect((data as Record<string, unknown>[])[0]).not.toHaveProperty("external_url");
  });

  it("does not publish a digital product without a file or a link", async () => {
    const draft = must(
      await a.client
        .from("products")
        .insert({ store_id: storeA.id, title: "Empty", slug: "empty", price_cents: 100 })
        .select("id")
        .single(),
      "insert empty draft",
    ) as Row;
    const publish = await a.client.from("products").update({ status: "published" }).eq("id", draft.id);
    expect(publish.error?.code).toBe("23514");

    const withLink = await a.client
      .from("products")
      .update({ external_url: "https://example.test/empty", status: "published" })
      .eq("id", draft.id)
      .select("status");
    expect(withLink.error).toBeNull();
    expect(withLink.data).toEqual([{ status: "published" }]);

    const removeLink = await a.client.from("products").update({ external_url: null }).eq("id", draft.id);
    expect(removeLink.error?.code).toBe("23514");
  });

  it("publishes a digital product that has a file", async () => {
    const draft = must(
      await a.client
        .from("products")
        .insert({ store_id: storeA.id, title: "With file", slug: "with-file", price_cents: 100 })
        .select("id")
        .single(),
      "insert draft with file",
    ) as Row;
    must(
      await a.client
        .from("product_files")
        .insert({ product_id: draft.id, storage_path: `rls/${runId}/f.pdf`, file_name: "f.pdf", size_bytes: 1 })
        .select("id"),
      "insert file",
    );
    const publish = await a.client.from("products").update({ status: "published" }).eq("id", draft.id).select("status");
    expect(publish.error).toBeNull();
    expect(publish.data).toEqual([{ status: "published" }]);
  });
});

// Runs last: removes creator B, so every check above that uses B's data must come first.
describe("account deletion", () => {
  it("deleting a creator with sales removes their store, products and orders", async () => {
    const { error } = await admin.auth.admin.deleteUser(b.id);
    expect(error).toBeNull();
    expect(ids((await admin.from("stores").select("id").eq("id", storeB.id)).data)).toEqual([]);
    expect(ids((await admin.from("products").select("id").eq("id", productB.id)).data)).toEqual([]);
    expect(ids((await admin.from("orders").select("id").eq("id", orderB.id)).data)).toEqual([]);
    expect(ids((await admin.from("enrollments").select("id").eq("id", enrollmentB.id)).data)).toEqual([]);
  });

  it("keeps the buyer's other purchases", async () => {
    expect(ids((await buyer.client.from("orders").select("id")).data)).toEqual([orderA.id]);
    expect(ids((await buyer.client.from("enrollments").select("id")).data)).toEqual([enrollmentA.id]);
  });
});
