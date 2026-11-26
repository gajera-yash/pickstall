import { describe, expect, it, vi } from "vitest";

// D-134: structured data, llms.txt, robots, sitemap pages and the content facts.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_APP_URL: "https://www.pickstall.store" } }));

import { FAQ, STAN } from "@/components/landing/content";
import { GET as llms } from "@/app/llms.txt/route";
import robots from "@/app/robots";
import { isTrackedPath } from "@/lib/analytics/platform";
import { PLANNED_PRICE_CENTS } from "@/lib/config";
import { COMPARE_PAGES, USE_CASE_PAGES, findCompare } from "@/lib/seo/pages";
import { breadcrumbSchema, faqSchema, jsonLdText, organizationSchema, softwareApplicationSchema } from "@/lib/seo/schema";
import { AI_CRAWLERS, ONE_LINER } from "@/lib/seo/site-facts";

describe("structured data", () => {
  it("describes Pickstall with its real plan prices", () => {
    const app = softwareApplicationSchema() as { offers: { price: string; priceCurrency: string }[] };
    expect(app.offers.map((offer) => offer.price)).toEqual([(PLANNED_PRICE_CENTS.starter / 100).toFixed(2), (PLANNED_PRICE_CENTS.pro / 100).toFixed(2)]);
    expect(app.offers.every((offer) => offer.priceCurrency === "USD")).toBe(true);
    expect(organizationSchema()).toMatchObject({ "@type": "Organization", description: ONE_LINER });
  });

  it("turns the FAQ and breadcrumbs into schema.org lists", () => {
    const faq = faqSchema(FAQ) as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(faq.mainEntity).toHaveLength(FAQ.length);
    expect(faq.mainEntity[0]?.name).toBe("What is Pickstall?");
    const crumbs = breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }]) as { itemListElement: { position: number; item: string }[] };
    expect(crumbs.itemListElement[1]).toMatchObject({ position: 2, item: "https://www.pickstall.store/pricing" });
  });

  it("can never close the script tag", () => {
    const text = jsonLdText({ name: "</script><script>alert(1)</script> & co" });
    expect(text).not.toContain("</script>");
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({ name: "</script><script>alert(1)</script> & co" });
  });
});

describe("content pages", () => {
  it("compare pages cite a source with a date, and say when the other option fits better", () => {
    expect(COMPARE_PAGES.map((page) => page.slug)).toEqual(["stan-store", "gumroad", "linktree"]);
    for (const page of COMPARE_PAGES) {
      expect(page.source.url).toMatch(/^https:\/\//);
      expect(page.source.checkedOn).toBeTruthy();
      expect(page.whenOther.length).toBeGreaterThan(0);
    }
    expect(findCompare("stan-store")?.rows[0]?.other).toContain(`$${STAN.creatorCents / 100}`);
    expect(findCompare("gumroad")?.rows[1]?.other).toBe("10% + $0.50 on direct sales, 30% via Discover");
    expect(USE_CASE_PAGES.map((page) => page.slug)).toEqual(["coaches", "fitness", "course-creators"]);
  });
});

describe("llms.txt, robots and analytics paths", () => {
  it("summarises Pickstall in Markdown with links to every content page", async () => {
    const response = llms();
    expect(response.headers.get("content-type")).toContain("text/markdown");
    const text = await response.text();
    expect(text.startsWith("# Pickstall")).toBe(true);
    expect(text).toContain(`> ${ONE_LINER}`);
    for (const path of ["/pricing", "/faq", "/compare/gumroad", "/for/coaches"]) expect(text).toContain(`https://www.pickstall.store${path}`);
  });

  it("welcomes AI crawlers on public pages and keeps private paths out for everyone", () => {
    const rules = robots().rules as { userAgent: string | string[]; disallow: string[] }[];
    const ai = rules.find((rule) => Array.isArray(rule.userAgent));
    expect(ai?.userAgent).toEqual(AI_CRAWLERS);
    for (const rule of rules) expect(rule.disallow).toContain("/dashboard");
  });

  it("measures the content pages after consent, but never dashboards or stores", () => {
    for (const path of ["/pricing", "/compare/stan-store", "/for/coaches", "/about"]) expect(isTrackedPath(path)).toBe(true);
    for (const path of ["/compare/a/b", "/for/", "/compare/<x>"]) expect(isTrackedPath(path)).toBe(false);
  });
});
