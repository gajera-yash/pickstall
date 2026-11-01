import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { MongoClient } from "mongodb";

// R9 smoke: the public buying path end to end on the development mock provider, plus the access
// rules a browser can check. Runs on the throwaway database started by scripts/e2e.mjs.

const STORE = { slug: "e2e-store", name: "E2E Store" };
const DRAFT = { slug: "e2e-draft", name: "E2E Draft Store" };
const PRODUCT = { slug: "e2e-guide", title: "E2E Guide", question: "Your Instagram" };
const BUYER = "e2e-buyer@example.com";

test.describe.configure({ mode: "serial" });

async function withDb<T>(work: (db: ReturnType<MongoClient["db"]>) => Promise<T>): Promise<T> {
  const client = new MongoClient(process.env.MONGODB_URI ?? "");
  try {
    return await work(client.db(process.env.MONGODB_DB ?? "pickstall_e2e"));
  } finally {
    await client.close();
  }
}

// Seed after the app has created its indexes on the empty database: the Windows test mongod (8.2.6)
// crashes when the app builds several indexes at once over collections that already hold documents.
test.beforeAll(async ({ request }) => {
  await request.get("/@no-such-store-warmup");
  await withDb(async (db) => {
    const now = new Date();
    const store = (slug: string, name: string, isPublished: boolean) => ({
      _id: randomUUID(),
      ownerId: randomUUID(),
      slug,
      name,
      bio: "Seeded by the e2e smoke test.",
      avatarUrl: null,
      socialLinks: [],
      theme: { preset: "clean", accent: "#0056FF" },
      currency: "usd",
      stripeAccountId: null,
      stripeChargesEnabled: false,
      isPublished,
      createdAt: now,
      updatedAt: now,
    });
    const live = store(STORE.slug, STORE.name, true);
    await db.collection("stores").insertMany([live, store(DRAFT.slug, DRAFT.name, false)] as never[]);
    await db.collection("products").insertOne({
      _id: randomUUID(),
      storeId: live._id,
      type: "digital",
      title: PRODUCT.title,
      slug: PRODUCT.slug,
      description: "A seeded product for the smoke test.",
      coverUrl: null,
      pricingModel: "fixed",
      priceCents: 1900,
      minPriceCents: null,
      externalUrl: "https://files.example.com/e2e-secret-download",
      buttonText: null,
      downloadLimit: 3,
      status: "published",
      checkout: { headline: null, askPhone: false, questions: [{ id: randomUUID(), label: PRODUCT.question, kind: "text", required: true, options: [] }] },
      afterPurchase: { thankYou: null, redirectUrl: null, emailSubject: null, emailBody: null },
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    } as never);
  });
});

test("the public store page renders with security headers", async ({ page }) => {
  const response = await page.goto(`/@${STORE.slug}`);
  expect(response?.status()).toBe(200);
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
  await expect(page.getByRole("heading", { name: STORE.name })).toBeVisible();
  await expect(page.getByText(PRODUCT.title).first()).toBeVisible();
  expect(await page.content()).not.toContain("e2e-secret-download");
});

test("a draft store is not public", async ({ page }) => {
  await page.goto(`/@${DRAFT.slug}`);
  await expect(page.getByText(DRAFT.name)).toHaveCount(0);
});

test("an anonymous buyer pays with the test provider and gets one paid order and one email", async ({ page }) => {
  await page.goto(`/@${STORE.slug}/${PRODUCT.slug}`);
  await page.getByRole("link", { name: /buy now/i }).first().click();
  await page.waitForURL(/\/checkout$/);

  await page.getByLabel("Your name").fill("E2E Buyer");
  await page.getByLabel("Email", { exact: true }).fill(BUYER);
  await page.getByLabel(new RegExp(PRODUCT.question)).fill("@e2e");
  await page.getByRole("button", { name: /pay now/i }).click();

  await page.waitForURL(/\/mock-pay\//);
  await page.getByRole("button", { name: "Pay (test)" }).click();
  await page.waitForURL(/\/thank-you\?order=/);
  await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible();

  const orderId = new URL(page.url()).searchParams.get("order") ?? "";
  await expect
    .poll(() => withDb(async (db) => ({
      paid: await db.collection("orders").countDocuments({ buyerEmail: BUYER, status: "paid" }),
      emails: await db.collection("emailOutbox").countDocuments({ orderId }),
    })))
    .toEqual({ paid: 1, emails: 1 });

  const order = await withDb((db) => db.collection("orders").findOne({ _id: orderId as never }));
  expect(order?.totalCents).toBe(1900);
  expect(order?.answers).toEqual([expect.objectContaining({ label: PRODUCT.question, value: "@e2e" })]);
});

test("private pages send anonymous visitors to sign in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/library");
  await expect(page).toHaveURL(/\/login/);
});

test("the delivery endpoint and webhooks refuse unauthenticated requests", async ({ request }) => {
  const order = await withDb((db) => db.collection("orders").findOne({ buyerEmail: BUYER }));
  const open = await request.post(`/library/${String(order?._id)}/open`, { maxRedirects: 0, headers: { origin: "https://evil.example.com" } });
  expect(open.status()).toBe(403); // a cross-site POST is refused before any check
  expect(open.headers()["location"] ?? "").not.toContain("files.example.com");

  const webhook = await request.post("/api/webhooks/stripe-connect", { data: "{}", headers: { "content-type": "application/json" } });
  expect(webhook.status()).toBe(400);
});

test("store, product and checkout pages fit a 360 px screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  for (const path of [`/@${STORE.slug}`, `/@${STORE.slug}/${PRODUCT.slug}`, `/@${STORE.slug}/${PRODUCT.slug}/checkout`, "/login"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
