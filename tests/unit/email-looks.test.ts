import { beforeEach, describe, expect, it, vi } from "vitest";

// D-124: one email design per store for every email a creator writes, and ready-made texts.

const db = vi.hoisted(() => ({ stores: { findOne: vi.fn(), updateOne: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));
vi.mock("@/lib/db/mongo", () => ({ isDuplicateKeyError: () => false }));

import { cartSettingsInput, renderCartReminder } from "@/lib/abandoned-cart/rules";
import { listEmailInput, renderListEmail } from "@/lib/broadcasts/rules";
import { EMAIL_LOOKS, emailDesignOf, lookOf, renderLook } from "@/lib/email/looks";
import { EMAIL_PRESETS } from "@/lib/email/presets";
import { renderOrderEmail } from "@/lib/email/templates";
import { PRODUCT_LIMITS } from "@/lib/products/schemas";
import { unknownEmailVariables } from "@/lib/products/text";
import { renderReviewRequest, reviewRequestSettingsInput } from "@/lib/review-request/rules";
import { findEmailLook, updateEmailLook } from "@/lib/stores/queries";

const vars = { customerName: "Asha", productTitle: "Workbook", accessLink: "https://www.pickstall.store/welcome/t1" };

describe("email looks", () => {
  it("always carry the store name, the button and the footer, escaped, in every look", () => {
    for (const look of EMAIL_LOOKS) {
      const html = renderLook({ look, accent: "#C2410C", storeName: "<b>Maya</b>", contentHtml: "<p>Hi</p>", button: { label: "Open", url: 'https://x.test/a"b' }, footerHtml: "Sent for Maya" });
      expect(html).toContain("Sent for Maya");
      expect(html).toContain('href="https://x.test/a&quot;b"');
      expect(html).toContain("#C2410C");
      expect(html).not.toContain("<b>Maya</b>");
      // The simple look names the store in the footer the email adds; the others show it at the top.
      if (look !== "simple") expect(html).toContain("&lt;b&gt;Maya&lt;/b&gt;");
    }
  });

  it("falls back to the Pickstall blue for a bad accent, and reads saved looks safely", () => {
    expect(renderLook({ look: "bold", accent: "red;background:url(x)", storeName: "S", contentHtml: "", footerHtml: "" })).not.toContain("url(x)");
    expect(lookOf("bold", "card")).toBe("bold");
    expect(lookOf("<script>", "card")).toBe("card");
    expect(emailDesignOf({ emailLook: "minimal", theme: { accent: "#C2410C" } })).toEqual({ look: "minimal", accent: "#C2410C" });
    expect(emailDesignOf({ emailLook: null, theme: { accent: "#C2410C" } })).toBeNull();
  });

  it("is used by all five emails, which keep their fixed parts", () => {
    const design = { look: "bold" as const, accent: "#C2410C" };
    const order = renderOrderEmail({ storeName: "Maya", vars, subject: null, body: "Thanks!", design });
    expect(order.html).toContain("background:#C2410C");
    expect(order.html).toContain(vars.accessLink);
    expect(order.html).toContain("Sent for Maya through Pickstall");

    const list = renderListEmail({ storeName: "Maya", subject: "Hi", body: "News", name: "Asha", unsubscribeUrl: "https://www.pickstall.store/u/tok", design });
    expect(list.html).toContain("https://www.pickstall.store/u/tok");
    expect(list.html).toContain("background:#C2410C");

    expect(renderCartReminder({ storeName: "Maya", productTitle: "W", buyerName: "Asha", subject: "", body: "", checkoutUrl: "https://x.test/c", design }).html).toContain("Finish your order");
    expect(renderReviewRequest({ storeName: "Maya", productTitle: "W", buyerName: "Asha", subject: "", body: "", reviewUrl: "https://x.test/r", design }).html).toContain("Leave a review");
  });
});

describe("ready-made texts", () => {
  it("has 3 or 4 templates for each email, all passing that email's own rules", () => {
    for (const presets of Object.values(EMAIL_PRESETS)) expect(presets.length).toBeGreaterThanOrEqual(3);
    for (const preset of EMAIL_PRESETS.confirmation) {
      expect(unknownEmailVariables(preset.subject + preset.body)).toEqual([]);
      expect(preset.subject.length).toBeLessThanOrEqual(PRODUCT_LIMITS.emailSubject);
      expect(preset.body.length).toBeLessThanOrEqual(PRODUCT_LIMITS.emailBody);
    }
    for (const preset of [...EMAIL_PRESETS.welcome, ...EMAIL_PRESETS.broadcast]) expect(listEmailInput.safeParse({ subject: preset.subject, body: preset.body }).success).toBe(true);
    for (const preset of EMAIL_PRESETS.cart) expect(cartSettingsInput.safeParse({ enabled: true, subject: preset.subject, body: preset.body }).success).toBe(true);
    for (const preset of EMAIL_PRESETS.review) expect(reviewRequestSettingsInput.safeParse({ enabled: true, subject: preset.subject, body: preset.body }).success).toBe(true);
  });
});

describe("saving the email look (owner filter)", () => {
  beforeEach(() => vi.clearAllMocks());
  it("reads and writes only the owner's store", async () => {
    db.stores.findOne.mockResolvedValue({ emailLook: "card" });
    expect(await findEmailLook("user-a")).toBe("card");
    expect(db.stores.findOne.mock.calls[0]?.[0]).toEqual({ ownerId: "user-a" });
    db.stores.updateOne.mockResolvedValue({ matchedCount: 1 });
    expect(await updateEmailLook("user-a", "bold")).toBe(true);
    expect(db.stores.updateOne.mock.calls[0]?.[0]).toEqual({ ownerId: "user-a" });
    expect(db.stores.updateOne.mock.calls[0]?.[1].$set.emailLook).toBe("bold");
  });
});
