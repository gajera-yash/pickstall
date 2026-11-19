import { beforeEach, describe, expect, it, vi } from "vitest";

// Fixes from the QA sheet of 2026-11: shared helpers, the empty-draft lookup (owner filter) and
// the setup progress that ignores an empty "Untitled product".

const hoisted = vi.hoisted(() => ({ products: { findOne: vi.fn(), find: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env.server", () => ({ serverEnv: {} }));
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => ({ products: hoisted.products })) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: () => false }));
vi.mock("@/lib/payments/connect", () => ({ connectAvailable: () => true }));
vi.mock("@/lib/payments/test-account", () => ({ testSellerAccountId: () => null }));

import { loadSetupState } from "@/lib/dashboard/setup-state";
import { loginPath } from "@/lib/auth/redirect";
import { maskedProviderMessage } from "@/lib/email/send";
import { findEmptyDraft } from "@/lib/products/queries";
import { shownProductSlug, slugFromTitle } from "@/lib/products/slug";
import { errorFor, fieldErrors } from "@/lib/result";
import { httpsUrlSchema, isHttpsUrl } from "@/lib/stores/schemas";

describe("product link shown in the editor", () => {
  it("follows the title of a draft", () => {
    expect(shownProductSlug("draft", "untitled-product-2325", "QA Test Product")).toBe("qa-test-product");
    expect(slugFromTitle("Crème brûlée guide!")).toBe("creme-brulee-guide");
  });

  it("keeps the saved link when it already matches the title, with or without a suffix", () => {
    expect(shownProductSlug("draft", "qa-test-product", "QA Test Product")).toBe("qa-test-product");
    expect(shownProductSlug("draft", "qa-test-product-a1b2", "QA Test Product")).toBe("qa-test-product-a1b2");
  });

  it("never changes the link of a published product", () => {
    expect(shownProductSlug("published", "old-link", "A new title")).toBe("old-link");
  });
});

describe("result helpers", () => {
  it("reports every field at once, the first one as the main error", () => {
    const result = fieldErrors({ title: "Give your product a title.", price: "Enter a price." });
    expect(result).toEqual({ ok: false, error: "Give your product a title.", field: "title", fields: { title: "Give your product a title.", price: "Enter a price." } });
    expect(errorFor(result.ok ? null : result, "price")).toBe("Enter a price.");
    expect(errorFor(result.ok ? null : result, "headline")).toBeNull();
  });

  it("falls back to a plain error without fields, and reads a single-field error", () => {
    expect(fieldErrors({}, "Check it.")).toEqual({ ok: false, error: "Check it." });
    expect(errorFor({ error: "Bad link", field: "redirectUrl" }, "redirectUrl")).toBe("Bad link");
  });
});

describe("https links (D-014)", () => {
  it("accepts only full https links", () => {
    expect(isHttpsUrl("https://example.com/page")).toBe(true);
    expect(isHttpsUrl("http://insecure.example.com")).toBe(false);
    expect(isHttpsUrl("not a url")).toBe(false);
    expect(isHttpsUrl("https://localhost")).toBe(false);
    expect(isHttpsUrl("https://user:pass@example.com")).toBe(false);
  });

  it("is the same rule the server schema uses", () => {
    expect(httpsUrlSchema("link").safeParse("http://insecure.example.com").success).toBe(false);
    expect(httpsUrlSchema("link").safeParse("").success).toBe(true);
  });
});

describe("session expired on a signed-in action", () => {
  it("adds the expired notice and keeps where to come back to", () => {
    expect(loginPath("/dashboard/setup?step=publish", { expired: true })).toBe("/login?next=%2Fdashboard%2Fsetup%3Fstep%3Dpublish&error=expired");
    expect(loginPath(undefined, { expired: true })).toBe("/login?error=expired");
    expect(loginPath("//evil.test", { expired: true })).toBe("/login?error=expired");
  });
});

describe("provider error messages in logs", () => {
  it("masks email addresses", () => {
    expect(maskedProviderMessage("Invalid `to` field: buyer@example.com is not allowed")).toBe("Invalid `to` field: [email] is not allowed");
    expect(maskedProviderMessage(undefined)).toBeUndefined();
  });
});

describe("findEmptyDraft", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only looks in the given store, for an untouched draft", async () => {
    hoisted.products.findOne.mockResolvedValue({ _id: "p1" });
    expect(await findEmptyDraft("store-a")).toEqual({ id: "p1" });
    const [filter] = hoisted.products.findOne.mock.calls[0] as [Record<string, unknown>];
    expect(filter).toMatchObject({ storeId: "store-a", type: "digital", status: "draft", title: "Untitled product", priceCents: 0, externalUrl: null, fileId: null, deletedAt: null });
  });

  it("finds nothing when creator B's store has no empty draft (creator A's drafts are never read)", async () => {
    hoisted.products.findOne.mockResolvedValue(null);
    expect(await findEmptyDraft("store-b")).toBeNull();
    expect(hoisted.products.findOne).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-b" }), expect.anything());
  });
});

describe("setup progress ignores an empty 'Untitled product'", () => {
  const store = { id: "store-a", bio: "Hi", avatarUrl: null, stripeChargesEnabled: false, isPublished: false, profileSaved: true };
  const listing = (docs: Record<string, unknown>[]) => ({ sort: () => ({ limit: () => ({ toArray: async () => docs }) }) });
  const untitled = { _id: "p1", storeId: "store-a", type: "digital", status: "draft", title: "Untitled product" };

  beforeEach(() => vi.clearAllMocks());

  it("keeps 'Add your first product' open for an untouched draft", async () => {
    hoisted.products.find.mockReturnValue(listing([untitled]));
    const { checklist } = await loadSetupState(store);
    expect(checklist.items.find((item) => item.id === "first-product")?.done).toBe(false);
    expect(checklist.doneCount).toBe(1);
  });

  it("counts a named product, and keeps counting drafts for a store that is already live", async () => {
    hoisted.products.find.mockReturnValue(listing([{ ...untitled, title: "QA Test Product" }]));
    expect((await loadSetupState(store)).checklist.items.find((item) => item.id === "first-product")?.done).toBe(true);
    hoisted.products.find.mockReturnValue(listing([untitled]));
    expect((await loadSetupState({ ...store, isPublished: true })).checklist.items.find((item) => item.id === "first-product")?.done).toBe(true);
  });
});
