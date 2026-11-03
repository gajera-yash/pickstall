import { describe, expect, it } from "vitest";

import { detailsMissing, nextStep, previousStep, stepOfField, stepsDone } from "@/lib/products/editor-steps";
import { publishProblems } from "@/lib/products/publish";

describe("product editor steps (D-048)", () => {
  it("walks Details, Checkout form, Publish in order", () => {
    expect(nextStep("details")).toBe("checkout");
    expect(nextStep("checkout")).toBe("publish");
    expect(nextStep("publish")).toBeNull();
    expect(previousStep("details")).toBeNull();
    expect(previousStep("publish")).toBe("checkout");
  });

  it("opens the step that holds a field with a problem", () => {
    expect(stepOfField("salePrice")).toBe("details");
    expect(stepOfField("question-2")).toBe("checkout");
    expect(stepOfField("emailBody")).toBe("publish");
    expect(stepOfField("downloadLimit")).toBe("publish");
    expect(stepOfField("nonsense")).toBeNull();
    expect(stepOfField(undefined)).toBeNull();
  });

  it("lists what Details still needs", () => {
    expect(detailsMissing({ title: " ", priceValid: false, hasDelivery: false })).toEqual([
      "Add a title.",
      "Enter a valid price (0 for free).",
      "Add a link or a file to deliver.",
    ]);
    expect(detailsMissing({ title: "Guide", priceValid: true, hasDelivery: true })).toEqual([]);
  });

  it("checks Checkout only once Details is done and the creator went past it", () => {
    expect(stepsDone({ detailsOk: true, furthest: "checkout", published: false })).toEqual({ details: true, checkout: false, publish: false });
    expect(stepsDone({ detailsOk: true, furthest: "publish", published: false })).toEqual({ details: true, checkout: true, publish: false });
    expect(stepsDone({ detailsOk: false, furthest: "publish", published: false }).checkout).toBe(false);
    expect(stepsDone({ detailsOk: true, furthest: "publish", published: true }).publish).toBe(true);
  });

  it("shows the same publish problems the server checks", () => {
    const product = { title: "Guide", priceCents: 1900, salePriceCents: null, externalUrl: "https://x.example.com" };
    expect(publishProblems(product, true)).toEqual([]);
    expect(publishProblems({ ...product, externalUrl: null }, true)).toEqual(["Add a link or a file to deliver."]);
    expect(publishProblems(product, false)).toEqual(["Connect payments to publish a paid product."]);
    expect(publishProblems({ ...product, priceCents: 0 }, false)).toEqual([]);
  });
});
