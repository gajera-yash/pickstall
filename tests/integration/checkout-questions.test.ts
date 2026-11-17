import { describe, expect, it } from "vitest";

// A field the creator adds to the checkout form and saves must show on the buyer's checkout page
// (founder bug report, 2026-11-17): save, then load the checkout exactly as the page does.

import { loadCheckoutContext } from "@/lib/orders/queries";
import { updateProduct } from "@/lib/products/queries";
import type { ProductInput } from "@/lib/products/schemas";

import { seedProduct, seedStore } from "./fixtures";

const base: ProductInput = {
  title: "Preset pack",
  description: undefined,
  descriptionDoc: null,
  coverUrl: undefined,
  externalUrl: "https://example.com/download",
  deliveryType: "link",
  priceCents: 1900,
  salePriceCents: null,
  buttonText: undefined,
  downloadLimit: undefined,
  headline: "Get instant access",
  askPhone: true,
  questions: [],
  thankYou: undefined,
  redirectUrl: undefined,
  emailSubject: undefined,
  emailBody: undefined,
};

describe("checkout questions", () => {
  it("a newly added and saved question appears on the checkout page, in order", async () => {
    const store = await seedStore();
    const product = await seedProduct(store._id);

    const questions: ProductInput["questions"] = [
      { id: "ig", label: "Your Instagram handle", kind: "text", required: true, options: [] },
      { id: "lvl", label: "Your level", kind: "dropdown", required: false, options: ["Beginner", "Pro"] },
    ];
    expect(await updateProduct(store._id, product._id, { ...base, questions })).not.toBe("not_found");

    const context = await loadCheckoutContext(store.slug, product.slug);
    expect(context?.product.checkout).toEqual({ headline: "Get instant access", askPhone: true, questions });

    // Adding one more later shows too.
    const more = [...questions, { id: "ok", label: "I agree to be contacted", kind: "checkbox" as const, required: false, options: [] }];
    await updateProduct(store._id, product._id, { ...base, questions: more });
    expect((await loadCheckoutContext(store.slug, product.slug))?.product.checkout.questions.map((question) => question.id)).toEqual(["ig", "lvl", "ok"]);
  });
});
