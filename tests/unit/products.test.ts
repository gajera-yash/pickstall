import { beforeEach, describe, expect, it, vi } from "vitest";

import { formData, mockSession, rateLimit, redirectOf, userId, OPEN_ACCESS, PAUSED_ACCESS } from "./auth-mocks";

const queries = vi.hoisted(() => ({
  createDraftProduct: vi.fn(),
  deleteProduct: vi.fn(),
  findEmptyDraft: vi.fn(async () => null),
  findProduct: vi.fn(),
  setProductStatus: vi.fn(),
  updateProduct: vi.fn(),
  storeQueries: vi.fn(),
}));
vi.mock("@/lib/plans/usage", () => ({ countCourses: vi.fn(async () => 0), countPublishedCourses: vi.fn(async () => 0), videoSecondsUsed: vi.fn(async () => 0) }));
vi.mock("@/lib/products/queries", () => queries);
const productFiles = vi.hoisted(() => ({ removeFilesOfProduct: vi.fn(async () => undefined) }));
vi.mock("@/lib/files/product-files", () => productFiles);
vi.mock("@/lib/courses/cleanup", () => ({ removeCourseContent: vi.fn(async () => undefined) }));
vi.mock("@/lib/courses/curriculum", () => ({ countLessonsWithContent: vi.fn(async () => 0) }));

import { changeProductStatus, createProductAndEdit, removeProduct, saveProduct } from "@/lib/products/actions";
import { centsToInput, formatMoney, parseMoneyToCents, priceLimits, priceProblem } from "@/lib/products/money";
import { checkPublish, isPaid, paymentsReady } from "@/lib/products/publish";
import { productInputFor } from "@/lib/products/schemas";

const productInput = productInputFor("usd");
import { cleanText, isSensitiveQuestion, unknownEmailVariables } from "@/lib/products/text";
import { storeQueries } from "./auth-mocks";

const PRODUCT_ID = "11111111-2222-4333-8444-555555555555";

const valid = {
  title: "Instagram playbook",
  descriptionDoc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Everything you need." }] }] },
  coverUrl: "https://images.example.com/cover.jpg",
  externalUrl: "https://drive.example.com/file",
  deliveryType: "link",
  price: "19.99",
  discountOn: false,
  salePrice: "",
  buttonText: "Get it",
  downloadLimit: "",
  headline: "Instant access",
  askPhone: false,
  questions: [{ id: "q1", label: "Your Instagram handle?", kind: "text", required: true, options: [] }],
  thankYou: "Thanks!",
  redirectUrl: "",
  emailSubject: "Your {{product_title}} is ready",
  emailBody: "Hi {{customer_name}}, get it here: {{download_link}}",
};

describe("parseMoneyToCents", () => {
  it.each([
    ["19", 1900],
    ["19.5", 1950],
    ["19.99", 1999],
    ["$1,000.00", 100000],
    ["0", 0],
    [" 5 ", 500],
  ])("reads %s as %i cents", (raw, cents) => {
    expect(parseMoneyToCents(raw, "usd")).toBe(cents);
  });

  it.each(["", "abc", "-5", "1.999", "1e3", "12.", ".5"])("rejects %j", (raw) => {
    expect(parseMoneyToCents(raw, "usd")).toBeNull();
  });

  it("formats cents back", () => {
    expect(centsToInput(1999, "usd")).toBe("19.99");
    expect(centsToInput(null, "usd")).toBe("");
    expect(formatMoney(1999, "usd")).toBe("$19.99");
  });
});

describe("money in every Stripe currency (D-046)", () => {
  it("keeps zero-decimal currencies in whole units, as Stripe expects", () => {
    expect(parseMoneyToCents("500", "jpy")).toBe(500);
    expect(parseMoneyToCents("1,500", "krw")).toBe(1500);
    expect(parseMoneyToCents("500.00", "jpy")).toBe(500);
    expect(parseMoneyToCents("500.5", "jpy")).toBeNull();
    expect(formatMoney(500, "jpy")).toBe("¥500");
    expect(centsToInput(500, "jpy")).toBe("500");
  });

  it("sends ISK and UGX as two-decimal amounts ending in 00, with no fractions allowed", () => {
    expect(parseMoneyToCents("5", "isk")).toBe(500);
    expect(parseMoneyToCents("5.50", "isk")).toBeNull();
    expect(centsToInput(500, "isk")).toBe("5");
    expect(priceProblem(550, "isk")).toMatch(/whole amount/);
  });

  it("keeps two decimals for other currencies, upper or lower case", () => {
    expect(parseMoneyToCents("12.5", "EUR")).toBe(1250);
    expect(formatMoney(1250, "EUR")).toBe("€12.50");
    expect(formatMoney(123456, "inr")).toBe("₹1,234.56");
  });

  it("uses Stripe's minimum charge where Stripe lists one, else one whole unit", () => {
    expect(priceLimits("usd").minPaid).toBe(50);
    expect(priceLimits("gbp").minPaid).toBe(30);
    expect(priceLimits("jpy").minPaid).toBe(50);
    expect(priceLimits("huf").minPaid).toBe(17500);
    expect(priceLimits("vnd").minPaid).toBe(1);
    expect(priceLimits("kes").minPaid).toBe(100);
    expect(priceLimits("usd").max).toBe(99_999_999);
  });

  it("allows free, refuses amounts under the minimum or over the 8-digit limit", () => {
    expect(priceProblem(0, "usd")).toBeNull();
    expect(priceProblem(49, "usd")).toMatch(/at least \$0\.50/);
    expect(priceProblem(50, "usd")).toBeNull();
    expect(priceProblem(100_000_000, "usd")).toMatch(/highest/);
  });
});

describe("cleanText and guardrails (D-014)", () => {
  it("removes HTML tags and control characters, keeps plain text", () => {
    expect(cleanText('Hello <script>alert(1)</script><b>world</b>\u0000!')).toBe("Hello alert(1)world!");
    expect(cleanText("I <3 you")).toBe("I <3 you");
  });

  it("keeps line breaks only for multiline text", () => {
    expect(cleanText("a\nb")).toBe("ab");
    expect(cleanText("a\nb", { multiline: true })).toBe("a\nb");
  });

  it("allows only the three email variables", () => {
    expect(unknownEmailVariables("Hi {{customer_name}} {{ product_title }} {{download_link}}")).toEqual([]);
    expect(unknownEmailVariables("{{secret}} {{customer_name}} {{other}}")).toEqual(["secret", "other"]);
  });

  it.each(["Your card number", "Credit card?", "CVV", "Passport no.", "Aadhaar number", "Account password", "Bank account"])("blocks the sensitive question %j", (label) => {
    expect(isSensitiveQuestion(label)).toBe(true);
  });

  it("allows normal questions", () => {
    expect(isSensitiveQuestion("What's your Instagram handle?")).toBe(false);
    expect(isSensitiveQuestion("Which card game do you play?")).toBe(false);
  });
});

describe("productInput", () => {
  it("accepts a complete product and converts money to cents", () => {
    const parsed = productInput.parse(valid);
    expect(parsed).toMatchObject({ title: "Instagram playbook", priceCents: 1999, salePriceCents: null });
    expect(parsed.redirectUrl).toBeUndefined();
    expect(parsed.questions[0]).toMatchObject({ label: "Your Instagram handle?", required: true });
  });

  it("strips HTML from every text field", () => {
    const descriptionDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "<img src=x onerror=alert(1)>Nice" }] }] };
    const parsed = productInput.parse({ ...valid, title: "<b>Big</b> sale", descriptionDoc });
    expect(parsed.title).toBe("Big sale");
    expect(parsed.description).toBe("Nice");
  });

  it("makes the plain description from the checked document, never from the client (D-049)", () => {
    const parsed = productInput.parse({ ...valid, description: "sent by the client" });
    expect(parsed.description).toBe("Everything you need.");
    const empty = productInput.parse({ ...valid, descriptionDoc: { type: "doc", content: [{ type: "paragraph" }] } });
    expect(empty).toMatchObject({ description: undefined, descriptionDoc: null });
    expect(productInput.safeParse({ ...valid, descriptionDoc: { type: "doc", content: [{ type: "html", content: "<b>x</b>" }] } }).success).toBe(false);
  });

  it("saves a discounted price only while the discount is on (D-047)", () => {
    expect(productInput.parse({ ...valid, price: "29", discountOn: true, salePrice: "19" })).toMatchObject({ priceCents: 2900, salePriceCents: 1900 });
    expect(productInput.parse({ ...valid, price: "29", discountOn: false, salePrice: "19" })).toMatchObject({ priceCents: 2900, salePriceCents: null });
  });

  it("checks the discounted price in the store currency", () => {
    expect(productInputFor("jpy").parse({ ...valid, price: "3000", discountOn: true, salePrice: "2000" })).toMatchObject({ priceCents: 3000, salePriceCents: 2000 });
  });

  it.each([
    ["no title", { title: "  " }],
    ["a letter in the price", { price: "abc" }],
    ["a price above the maximum", { price: "1000000" }],
    ["a price below the paid minimum", { price: "0.49" }],
    ["a discount equal to the price", { price: "19", discountOn: true, salePrice: "19" }],
    ["a discount above the price", { price: "19", discountOn: true, salePrice: "25" }],
    ["a missing discounted price", { price: "19", discountOn: true, salePrice: "" }],
    ["a discounted price of 0", { price: "19", discountOn: true, salePrice: "0" }],
    ["a discounted price under Stripe's minimum", { price: "19", discountOn: true, salePrice: "0.49" }],
    ["a discount on a free product", { price: "0", discountOn: true, salePrice: "0" }],
    ["an http delivery link", { externalUrl: "http://example.com/x" }],
    ["a javascript redirect", { redirectUrl: "javascript:alert(1)" }],
    ["an unknown email variable", { emailBody: "Hi {{password}}" }],
    ["six questions", { questions: Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, label: "Q", kind: "text", required: false, options: [] })) }],
    ["a card-number question", { questions: [{ id: "q1", label: "Card number", kind: "text", required: true, options: [] }] }],
    ["a dropdown with one choice", { questions: [{ id: "q1", label: "Pick", kind: "dropdown", required: false, options: ["only"] }] }],
    ["duplicate question ids", { questions: [{ id: "a", label: "A", kind: "text", required: false, options: [] }, { id: "a", label: "B", kind: "text", required: false, options: [] }] }],
    ["a too-long title", { title: "x".repeat(81) }],
    ["a download limit of zero", { downloadLimit: "0" }],
    ["a discount toggle that is not a boolean", { discountOn: "yes" }],
  ])("rejects %s", (_label, override) => {
    expect(productInput.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("drops options of non-dropdown questions", () => {
    const parsed = productInput.parse({ ...valid, questions: [{ id: "q1", label: "Pick", kind: "text", required: false, options: ["a", "b"] }] });
    expect(parsed.questions[0]?.options).toEqual([]);
  });
});

describe("publish rules", () => {
  const free = { title: "T", priceCents: 0, salePriceCents: null, externalUrl: "https://x.example.com" };

  it("needs a delivery link or a file", () => {
    expect(checkPublish({ ...free, externalUrl: null }, { chargesEnabled: false })).toEqual({ ok: false, problems: ["Add a link or a file to deliver."] });
    expect(checkPublish({ ...free, externalUrl: null, deliveryType: "file", fileId: "f1" }, { chargesEnabled: false })).toEqual({ ok: true });
    // A file product needs its file, whatever link is left over from before (D-050).
    expect(checkPublish({ ...free, deliveryType: "file", fileId: null }, { chargesEnabled: false })).toMatchObject({ ok: false });
  });

  it("lets free products publish without payments", () => {
    expect(checkPublish(free, { chargesEnabled: false }, "production")).toEqual({ ok: true });
  });

  it("blocks paid products in production until Stripe is connected", () => {
    const paid = { ...free, priceCents: 1900 };
    expect(checkPublish(paid, { chargesEnabled: false }, "production")).toMatchObject({ ok: false });
    expect(checkPublish(paid, { chargesEnabled: true }, "production")).toEqual({ ok: true });
    expect(checkPublish(paid, { chargesEnabled: false }, "development")).toEqual({ ok: true });
  });

  it("knows what counts as paid and when payments are ready", () => {
    expect(isPaid({ priceCents: 0, salePriceCents: null })).toBe(false);
    expect(isPaid({ priceCents: 1000, salePriceCents: null })).toBe(true);
    expect(isPaid({ priceCents: 1000, salePriceCents: 500 })).toBe(true);
    expect(paymentsReady({ chargesEnabled: false }, "production")).toBe(false);
  });
});

describe("product actions use the session owner's store only", () => {
  const form = (overrides: Record<string, unknown> = {}) => formData({ payload: JSON.stringify({ ...valid, ...overrides }) });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    storeQueries.findStoreByOwner.mockResolvedValue({ access: OPEN_ACCESS, id: "store-1", slug: "maya", currency: "usd", stripeChargesEnabled: false });
    rateLimit.takeRateLimit.mockResolvedValue(true);
  });

  it("saves with the store id of the session, ignoring any storeId in the payload", async () => {
    queries.updateProduct.mockResolvedValue("saved");
    const result = await saveProduct(PRODUCT_ID, null, form({ storeId: "store-of-someone-else" }));
    expect(result?.ok).toBe(true);
    expect(queries.updateProduct).toHaveBeenCalledWith("store-1", PRODUCT_ID, expect.objectContaining({ title: "Instagram playbook" }));
    expect(JSON.stringify(queries.updateProduct.mock.calls[0])).not.toContain("store-of-someone-else");
  });

  it("answers 'not found' for another creator's product", async () => {
    queries.updateProduct.mockResolvedValue("not_found");
    expect(await saveProduct(PRODUCT_ID, null, form())).toMatchObject({ ok: false });
    queries.findProduct.mockResolvedValue(null);
    expect(await changeProductStatus(PRODUCT_ID, "published")).toMatchObject({ ok: false });
    expect(queries.setProductStatus).not.toHaveBeenCalled();
  });

  it("rejects a bad id and a bad payload without touching the database", async () => {
    expect(await saveProduct("not-a-uuid", null, form())).toMatchObject({ ok: false });
    expect(await saveProduct(PRODUCT_ID, null, formData({ payload: "{not json" }))).toMatchObject({ ok: false });
    expect(await saveProduct(PRODUCT_ID, null, formData({ payload: "x".repeat(50_000) }))).toMatchObject({ ok: false });
    expect(queries.updateProduct).not.toHaveBeenCalled();
  });

  it("points an invalid field out, including a question row", async () => {
    expect(await saveProduct(PRODUCT_ID, null, form({ price: "abc" }))).toMatchObject({ ok: false, field: "price" });
    const bad = [{ id: "q1", label: "Card number", kind: "text", required: false, options: [] }];
    expect(await saveProduct(PRODUCT_ID, null, form({ questions: bad }))).toMatchObject({ ok: false, field: "question-0" });
  });

  it("refuses to publish a product that breaks the rules", async () => {
    queries.findProduct.mockResolvedValue({ _id: PRODUCT_ID, title: "T", priceCents: 0, salePriceCents: null, externalUrl: null });
    expect(await changeProductStatus(PRODUCT_ID, "published")).toEqual({ ok: false, error: "Add a link or a file to deliver." });
    expect(queries.setProductStatus).not.toHaveBeenCalled();
  });

  it("does not publish while the store is paused, but still unpublishes (D-072)", async () => {
    storeQueries.findStoreByOwner.mockResolvedValue({ access: PAUSED_ACCESS, id: "store-1", slug: "maya", currency: "usd", stripeChargesEnabled: false });
    queries.findProduct.mockResolvedValue({ _id: PRODUCT_ID, title: "T", priceCents: 0, salePriceCents: null, externalUrl: "https://x.example.com" });
    queries.setProductStatus.mockResolvedValue(true);
    expect(await changeProductStatus(PRODUCT_ID, "published")).toMatchObject({ ok: false, error: expect.stringMatching(/store is paused/) });
    expect(queries.setProductStatus).not.toHaveBeenCalled();
    expect(await changeProductStatus(PRODUCT_ID, "draft")).toEqual({ ok: true, data: { status: "draft" } });
  });

  it("publishes a valid product and unpublishes without checks", async () => {
    queries.findProduct.mockResolvedValue({ _id: PRODUCT_ID, title: "T", priceCents: 0, salePriceCents: null, externalUrl: "https://x.example.com" });
    queries.setProductStatus.mockResolvedValue(true);
    expect(await changeProductStatus(PRODUCT_ID, "published")).toEqual({ ok: true, data: { status: "published" } });
    expect(queries.setProductStatus).toHaveBeenCalledWith("store-1", PRODUCT_ID, "published");
    expect(await changeProductStatus(PRODUCT_ID, "bogus")).toMatchObject({ ok: false });
  });

  it("saves and then publishes in one step with intent=publish (D-048)", async () => {
    queries.updateProduct.mockResolvedValue("saved");
    queries.findProduct.mockResolvedValue({ _id: PRODUCT_ID, title: "T", priceCents: 0, salePriceCents: null, externalUrl: "https://x.example.com" });
    queries.setProductStatus.mockResolvedValue(true);
    const publishForm = form();
    publishForm.set("intent", "publish");
    expect(await saveProduct(PRODUCT_ID, null, publishForm)).toMatchObject({ ok: true, data: { published: true } });
    // The rules are checked on the product as saved, found through the session owner's store.
    expect(queries.findProduct).toHaveBeenCalledWith("store-1", PRODUCT_ID);
    expect(queries.setProductStatus).toHaveBeenCalledWith("store-1", PRODUCT_ID, "published");
  });

  it("keeps the save but does not publish when a rule fails", async () => {
    queries.updateProduct.mockResolvedValue("saved");
    queries.findProduct.mockResolvedValue({ _id: PRODUCT_ID, title: "T", priceCents: 0, salePriceCents: null, externalUrl: null });
    const publishForm = form();
    publishForm.set("intent", "publish");
    expect(await saveProduct(PRODUCT_ID, null, publishForm)).toEqual({ ok: false, error: "Saved, but not published yet: Add a link or a file to deliver." });
    expect(queries.updateProduct).toHaveBeenCalled();
    expect(queries.setProductStatus).not.toHaveBeenCalled();
  });

  it("only saves without the publish intent", async () => {
    queries.updateProduct.mockResolvedValue("saved");
    expect(await saveProduct(PRODUCT_ID, null, form())).toMatchObject({ ok: true, data: { published: false } });
    expect(queries.setProductStatus).not.toHaveBeenCalled();
  });

  it("removes the product's file after deleting it for good, through the owner's store", async () => {
    queries.deleteProduct.mockResolvedValue("deleted");
    expect(await removeProduct(PRODUCT_ID)).toMatchObject({ ok: true, data: { kept: false } });
    expect(queries.deleteProduct).toHaveBeenCalledWith("store-1", PRODUCT_ID);
    expect(productFiles.removeFilesOfProduct).toHaveBeenCalledWith("store-1", PRODUCT_ID);
  });

  it("keeps the files of a product with orders, which is only hidden (D-059)", async () => {
    queries.deleteProduct.mockResolvedValue("hidden");
    expect(await removeProduct(PRODUCT_ID)).toMatchObject({ ok: true, data: { kept: true } });
    expect(productFiles.removeFilesOfProduct).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another store's product", async () => {
    queries.deleteProduct.mockResolvedValue("not_found");
    expect(await removeProduct(PRODUCT_ID)).toMatchObject({ ok: false });
  });

  it("is rate limited", async () => {
    rateLimit.takeRateLimit.mockResolvedValue(false);
    expect(await saveProduct(PRODUCT_ID, null, form())).toEqual({ ok: false, error: "Slow down a little, then try again." });
    expect(queries.updateProduct).not.toHaveBeenCalled();
  });

  it("creates a draft and opens its editor, or goes back with a reason", async () => {
    queries.createDraftProduct.mockResolvedValue({ id: PRODUCT_ID });
    expect(await redirectOf(() => createProductAndEdit())).toBe(`/dashboard/products/${PRODUCT_ID}`);
    queries.createDraftProduct.mockResolvedValue("limit");
    expect(await redirectOf(() => createProductAndEdit())).toBe("/dashboard/products?error=limit");
  });

  it("sends problems from the setup wizard back to its product step, not the locked products list (D-079)", async () => {
    queries.createDraftProduct.mockResolvedValue("limit");
    const fromSetup = new FormData();
    fromSetup.set("from", "setup");
    expect(await redirectOf(() => createProductAndEdit(fromSetup))).toBe("/dashboard/setup?step=first-product&error=limit");
  });

  it("opens the untouched empty draft again from the setup wizard instead of adding another (QA 2026-11)", async () => {
    queries.findEmptyDraft.mockResolvedValueOnce({ id: PRODUCT_ID } as never);
    const fromSetup = new FormData();
    fromSetup.set("from", "setup");
    expect(await redirectOf(() => createProductAndEdit(fromSetup))).toBe(`/dashboard/products/${PRODUCT_ID}?from=setup`);
    expect(queries.findEmptyDraft).toHaveBeenCalledWith("store-1", "digital");
    expect(queries.createDraftProduct).not.toHaveBeenCalled();
  });

  it("returns every field problem of a save at once (QA 2026-11)", async () => {
    const result = await saveProduct(PRODUCT_ID, null, form({ title: "", externalUrl: "not a url", price: "-5abc" }));
    expect(result).toMatchObject({ ok: false, fields: { title: expect.any(String), externalUrl: expect.any(String), price: expect.any(String) } });
    expect(queries.updateProduct).not.toHaveBeenCalled();
  });
});
