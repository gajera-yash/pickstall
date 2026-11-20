import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ orders: { aggregate: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn(async () => db) }));

import { BUMP_HOW_IT_WORKS, HowItWorks, UPSELL_HOW_IT_WORKS } from "@/components/dashboard/how-it-works";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { PLAN_LIMITS } from "@/lib/config";
import { PLAN_FEATURE_GROUPS } from "@/lib/plans/catalog";
import { salesByProduct } from "@/lib/products/stats";

const row = (label: string) => PLAN_FEATURE_GROUPS.flatMap((group) => group.rows).find((item) => item.label === label)!;

describe("plan feature list (D-103)", () => {
  it("matches the enforced limits and Pro features", () => {
    expect(row("Courses").values).toEqual({ starter: `Up to ${PLAN_LIMITS.starter.maxCourses}`, pro: "Unlimited" });
    expect(row("Course video hosting").values).toEqual({ starter: "20 hours", pro: "100 hours" });
    expect(row("Email subscribers").values).toEqual({ starter: "1,000", pro: "10,000" });
    expect(row("Coaching calls with booking").values).toEqual({ starter: false, pro: true });
    expect(row("Upsell and downsell after purchase").values).toEqual({ starter: false, pro: true });
    expect(row("Welcome email, abandoned cart and review request").values).toEqual({ starter: false, pro: true });
    expect(row("Order bumps at checkout").values).toEqual({ starter: true, pro: true });
  });
});

describe("one dropdown design (D-103)", () => {
  it("renders our styled trigger (Radix keeps only a hidden, unnamed native select) and a hidden input for forms", () => {
    const html = renderToStaticMarkup(createElement(ChoiceSelect, { id: "kind", name: "answer-q1", value: "", onValueChange: () => undefined, placeholder: "Choose...", options: [{ value: "a", label: "A" }] }));
    expect(html).not.toMatch(/<select[^>]*name=/);
    expect(html).toContain('data-slot="choice-select-trigger"');
    expect(html).toContain('<input type="hidden" name="answer-q1" value=""/>');
    expect(html).toContain("Choose...");
  });
});

describe("selling tools explained (D-103)", () => {
  it("explains order bumps and upsells with steps and an example", () => {
    const html = renderToStaticMarkup(createElement(HowItWorks, { content: UPSELL_HOW_IT_WORKS }));
    expect(html).toContain("<details");
    expect(html).toContain("Example:");
    expect(UPSELL_HOW_IT_WORKS.steps.join(" ")).toMatch(/two hours/);
    expect(BUMP_HOW_IT_WORKS.steps.join(" ")).toMatch(/same payment/);
  });
});

describe("sales per product (D-103)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts paid orders of the session's store only, leaving bump orders out", async () => {
    db.orders.aggregate.mockReturnValue({ toArray: async () => [{ _id: "p1", orders: 3, revenueCents: 8700 }] });
    const sales = await salesByProduct("store-b");
    expect(sales.get("p1")).toEqual({ orders: 3, revenueCents: 8700 });
    expect(db.orders.aggregate.mock.calls[0]![0][0]).toEqual({ $match: { storeId: "store-b", status: "paid", bumpOf: { $in: [null] } } });
  });
});
