import { beforeEach, describe, expect, it, vi } from "vitest";

import { formData, mockSession, rateLimit, redirectOf, userId } from "./auth-mocks";

const queries = vi.hoisted(() => ({
  createDraftProduct: vi.fn(),
  deleteProduct: vi.fn(),
  findProduct: vi.fn(),
  setProductStatus: vi.fn(),
  updateProduct: vi.fn(),
  storeQueries: vi.fn(),
}));
vi.mock("@/lib/products/queries", () => queries);

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
  description: "Everything you need.",
  coverUrl: "https://images.example.com/cover.jpg",
  externalUrl: "https://drive.example.com/file",
  pricingModel: "fixed",
  price: "19.99",
  minPrice: "",
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
    expect(parsed).toMatchObject({ title: "Instagram playbook", priceCents: 1999, minPriceCents: null, pricingModel: "fixed" });
    expect(parsed.redirectUrl).toBeUndefined();
    expect(parsed.questions[0]).toMatchObject({ label: "Your Instagram handle?", required: true });
  });

  it("strips HTML from every text field", () => {
    const parsed = productInput.parse({ ...valid, title: "<b>Big</b> sale", description: "<img src=x onerror=alert(1)>Nice" });
    expect(parsed.title).toBe("Big sale");
    expect(parsed.description).toBe("Nice");
  });

  it("handles pay-what-you-want with a minimum", () => {
    expect(productInput.parse({ ...valid, pricingModel: "pwyw", price: "20", minPrice: "5" })).toMatchObject({ priceCents: 2000, minPriceCents: 500 });
  });

  it.each([
    ["no title", { title: "  " }],
    ["a letter in the price", { price: "abc" }],
    ["a price above the maximum", { price: "1000000" }],
    ["a price below the paid minimum", { price: "0.49" }],
    ["a pwyw minimum above the suggested price", { pricingModel: "pwyw", price: "5", minPrice: "10" }],
    ["a missing pwyw minimum", { pricingModel: "pwyw", price: "5", minPrice: "" }],
    ["an http delivery link", { externalUrl: "http://example.com/x" }],
    ["a javascript redirect", { redirectUrl: "javascript:alert(1)" }],
    ["an unknown email variable", { emailBody: "Hi {{password}}" }],
    ["six questions", { questions: Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, label: "Q", kind: "text", required: false, options: [] })) }],
    ["a card-number question", { questions: [{ id: "q1", label: "Card number", kind: "text", required: true, options: [] }] }],
    ["a dropdown with one choice", { questions: [{ id: "q1", label: "Pick", kind: "dropdown", required: false, options: ["only"] }] }],
    ["duplicate question ids", { questions: [{ id: "a", label: "A", kind: "text", required: false, options: [] }, { id: "a", label: "B", kind: "text", required: false, options: [] }] }],
    ["a too-long title", { title: "x".repeat(81) }],
    ["a download limit of zero", { downloadLimit: "0" }],
    ["an unknown price type", { pricingModel: "free" }],
  ])("rejects %s", (_label, override) => {
    expect(productInput.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("drops options of non-dropdown questions", () => {
    const parsed = productInput.parse({ ...valid, questions: [{ id: "q1", label: "Pick", kind: "text", required: false, options: ["a", "b"] }] });
    expect(parsed.questions[0]?.options).toEqual([]);
  });
});

describe("publish rules", () => {
  const free = { title: "T", priceCents: 0, pricingModel: "fixed" as const, minPriceCents: null, externalUrl: "https://x.example.com" };

  it("needs a delivery link or a file", () => {
    expect(checkPublish({ ...free, externalUrl: null }, { stripeChargesEnabled: false })).toEqual({ ok: false, problems: ["Add a link or a file to deliver."] });
    expect(checkPublish({ ...free, externalUrl: null, fileCount: 1 }, { stripeChargesEnabled: false })).toEqual({ ok: true });
  });

  it("lets free products publish without payments", () => {
    expect(checkPublish(free, { stripeChargesEnabled: false }, "production")).toEqual({ ok: true });
  });

  it("blocks paid products in production until Stripe is connected", () => {
    const paid = { ...free, priceCents: 1900 };
    expect(checkPublish(paid, { stripeChargesEnabled: false }, "production")).toMatchObject({ ok: false });
    expect(checkPublish(paid, { stripeChargesEnabled: true }, "production")).toEqual({ ok: true });
    expect(checkPublish(paid, { stripeChargesEnabled: false }, "development")).toEqual({ ok: true });
  });

  it("knows what counts as paid and when payments are ready", () => {
    expect(isPaid({ priceCents: 0, pricingModel: "fixed", minPriceCents: null })).toBe(false);
    expect(isPaid({ priceCents: 1000, pricingModel: "pwyw", minPriceCents: 0 })).toBe(true);
    expect(paymentsReady({ stripeChargesEnabled: false }, "production")).toBe(false);
  });
});

describe("product actions use the session owner's store only", () => {
  const form = (overrides: Record<string, unknown> = {}) => formData({ payload: JSON.stringify({ ...valid, ...overrides }) });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession({ id: userId, email: "maya@example.com" });
    storeQueries.findStoreByOwner.mockResolvedValue({ id: "store-1", slug: "maya", currency: "usd", stripeChargesEnabled: false });
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
    queries.findProduct.mockResolvedValue({ _id: PRODUCT_ID, title: "T", priceCents: 0, pricingModel: "fixed", minPriceCents: null, externalUrl: null });
    expect(await changeProductStatus(PRODUCT_ID, "published")).toEqual({ ok: false, error: "Add a link or a file to deliver." });
    expect(queries.setProductStatus).not.toHaveBeenCalled();
  });

  it("publishes a valid product and unpublishes without checks", async () => {
    queries.findProduct.mockResolvedValue({ _id: PRODUCT_ID, title: "T", priceCents: 0, pricingModel: "fixed", minPriceCents: null, externalUrl: "https://x.example.com" });
    queries.setProductStatus.mockResolvedValue(true);
    expect(await changeProductStatus(PRODUCT_ID, "published")).toEqual({ ok: true, data: { status: "published" } });
    expect(queries.setProductStatus).toHaveBeenCalledWith("store-1", PRODUCT_ID, "published");
    expect(await changeProductStatus(PRODUCT_ID, "bogus")).toMatchObject({ ok: false });
  });

  it("deletes only through the owner's store and reports why a published product stays", async () => {
    queries.deleteProduct.mockResolvedValue(false);
    expect(await removeProduct(PRODUCT_ID)).toMatchObject({ ok: false });
    expect(queries.deleteProduct).toHaveBeenCalledWith("store-1", PRODUCT_ID);
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
});
