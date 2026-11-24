import { describe, expect, it, vi } from "vitest";

// D-119: where a creator signed up from (lead code + UTM tags), the badge link and the funnel summary.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/collections", () => ({ collections: vi.fn() }));

import { acquisitionFrom, acquisitionFromForm, badgeHref, leadCodeOf, OUTREACH_SOURCE, SIGNUP_SOURCE_FIELDS } from "@/lib/marketing/acquisition";
import { summarizeFunnel, type FunnelRow } from "@/lib/marketing/funnel";

describe("leadCodeOf", () => {
  it("keeps 3-32 letters, digits and dashes, lower-cased", () => {
    expect(leadCodeOf(" Priya-Notion-01 ")).toBe("priya-notion-01");
    expect(leadCodeOf("abc")).toBe("abc");
  });

  it("refuses anything else", () => {
    for (const bad of ["ab", "-abc", "a b c", "<script>", "x".repeat(33), "abc_def", "", null, 42, undefined]) expect(leadCodeOf(bad)).toBeNull();
  });
});

describe("acquisitionFrom", () => {
  it("keeps the lead code with the cleaned UTM tags", () => {
    expect(acquisitionFrom({ ref: "PRIYA-1", source: " Outreach ", medium: "DM", campaign: "<b>Founding</b>" }, "pickstall.store")).toEqual({
      ref: "priya-1",
      source: "outreach",
      medium: "dm",
      campaign: "founding",
      referrer: null,
    });
  });

  it("counts a lead code alone as our outreach", () => {
    expect(acquisitionFrom({ ref: "priya-1" }, "pickstall.store")).toEqual({ ref: "priya-1", source: OUTREACH_SOURCE, medium: null, campaign: null, referrer: null });
  });

  it("uses the referring site when there are no UTM tags, and drops a bad code", () => {
    expect(acquisitionFrom({ ref: "no way", referrer: "l.instagram.com" }, "pickstall.store")).toEqual({
      ref: null,
      source: "instagram",
      medium: null,
      campaign: null,
      referrer: "l.instagram.com",
    });
  });

  it("is null for a direct signup or a visit from our own pages", () => {
    expect(acquisitionFrom({}, "pickstall.store")).toBeNull();
    expect(acquisitionFrom({ referrer: "pickstall.store" }, "pickstall.store")).toBeNull();
    expect(acquisitionFrom({ ref: 12, source: 5 }, "pickstall.store")).toBeNull();
  });

  it("reads the hidden form fields", () => {
    const form = new FormData();
    form.set(SIGNUP_SOURCE_FIELDS.ref, "lead-7");
    form.set(SIGNUP_SOURCE_FIELDS.source, "pickstall_store");
    form.set(SIGNUP_SOURCE_FIELDS.campaign, "maya-books");
    expect(acquisitionFromForm(form, "pickstall.store")).toEqual({ ref: "lead-7", source: "pickstall_store", medium: null, campaign: "maya-books", referrer: null });
  });
});

describe("badgeHref", () => {
  it("tags the home link with the store", () => {
    expect(badgeHref("maya-books")).toBe("/?utm_source=pickstall_store&utm_medium=badge&utm_campaign=maya-books");
    expect(badgeHref(undefined)).toBe("/?utm_source=pickstall_store&utm_medium=badge");
  });
});

describe("summarizeFunnel", () => {
  const row = (source: string, steps: Partial<FunnelRow> = {}): FunnelRow => ({ source, published: false, paymentConnected: false, firstSale: false, paidPlan: false, ...steps });

  it("counts every step overall and per source, most signups first", () => {
    const summary = summarizeFunnel([
      row("outreach", { published: true, paymentConnected: true, firstSale: true }),
      row("outreach", { published: true }),
      row("direct"),
      row("outreach"),
      row("pickstall_store", { published: true, paymentConnected: true, firstSale: true, paidPlan: true }),
    ]);
    expect(summary.total).toEqual({ signups: 5, published: 3, paymentConnected: 2, firstSale: 2, paidPlan: 1 });
    expect(summary.bySource.map((source) => source.source)).toEqual(["outreach", "direct", "pickstall_store"]);
    expect(summary.bySource[0]).toEqual({ source: "outreach", signups: 3, published: 2, paymentConnected: 1, firstSale: 1, paidPlan: 0 });
  });

  it("keeps at most 20 sources and is empty without rows", () => {
    expect(summarizeFunnel(Array.from({ length: 25 }, (_, index) => row(`s${index}`))).bySource).toHaveLength(20);
    expect(summarizeFunnel([])).toEqual({ total: { signups: 0, published: 0, paymentConnected: 0, firstSale: 0, paidPlan: 0 }, bySource: [] });
  });
});
