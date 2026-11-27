import { describe, expect, it, vi } from "vitest";

// D-135 (GEO): creator store and product structured data, AI sources in attribution, llms-full.txt,
// the content date, more AI crawlers and the IndexNow payload.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_APP_URL: "https://www.pickstall.store" } }));
vi.mock("@/lib/env.server", () => ({ serverEnv: { INDEXNOW_KEY: undefined } }));

import { FAQ } from "@/components/landing/content";
import { GET as llmsFull } from "@/app/llms-full.txt/route";
import { GET as llms } from "@/app/llms.txt/route";
import robots from "@/app/robots";
import { attributionFrom, sourceOfHost } from "@/lib/analytics/attribution";
import { indexNowEnabled, indexNowPayload } from "@/lib/seo/indexnow";
import { COMPARE_PAGES } from "@/lib/seo/pages";
import { jsonLdText, organizationSchema, webPageSchema } from "@/lib/seo/schema";
import { AI_CRAWLERS, CONTENT_UPDATED } from "@/lib/seo/site-facts";
import { productPageSchema, schemaPrice, schemaText, storePageSchema, storePath, SCHEMA_TEXT_MAX } from "@/lib/seo/store-schema";
import type { PublicProduct, PublicStore } from "@/lib/stores/public";

const store = {
  id: "store-1",
  slug: "maya",
  name: "Maya <b>Yoga</b>",
  bio: "Yoga for beginners.\nNew classes every week.",
  avatarUrl: "/media/avatar-1",
  socialLinks: [
    { kind: "instagram", url: "https://instagram.com/maya" },
    { kind: "email", url: "mailto:maya@example.com" },
  ],
  theme: { preset: "classic", accent: "#000000" },
  currency: "usd",
  isOpen: true,
  pixels: null,
  pageBlocks: [],
} as unknown as PublicStore;

const product = {
  id: "product-1",
  slug: "morning-flow",
  title: "Morning Flow",
  description: "A 20-minute daily routine.",
  descriptionDoc: null,
  coverUrl: "https://cdn.example.com/cover.webp",
  priceCents: 2500,
  salePriceCents: 1250,
  buttonText: null,
  type: "digital",
  course: null,
  coaching: null,
  rating: null,
} as unknown as PublicProduct;

describe("store page structured data", () => {
  it("describes the creator as a ProfilePage, without emails or tags", () => {
    const schema = storePageSchema(store, [product]);
    expect(schema).toMatchObject([
      {
        "@type": "ProfilePage",
        url: "https://www.pickstall.store/@maya",
        mainEntity: { "@type": "Person", name: "Maya Yoga", description: "Yoga for beginners. New classes every week.", image: "https://www.pickstall.store/media/avatar-1", sameAs: ["https://instagram.com/maya"] },
      },
      { "@type": "ItemList", itemListElement: [{ position: 1, name: "Morning Flow", url: "https://www.pickstall.store/@maya/morning-flow" }] },
    ]);
    expect(JSON.stringify(schema)).not.toContain("example.com");
  });

  it("leaves the product list out for an empty store", () => {
    expect(storePageSchema(store, [])).toHaveLength(1);
  });

  it("cleans and shortens creator text", () => {
    expect(schemaText("  <script>x</script>Hi  ")).toBe("xHi");
    expect(schemaText("   ")).toBeUndefined();
    expect(schemaText(null)).toBeUndefined();
    const long = schemaText("a".repeat(SCHEMA_TEXT_MAX + 50)) ?? "";
    expect(long.length).toBe(SCHEMA_TEXT_MAX);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("product page structured data", () => {
  it("offers the price a buyer pays, in the store currency", () => {
    const schema = productPageSchema(store, product, { buyable: true });
    expect(schema).toMatchObject([
      {
        "@type": "Product",
        offers: { price: "12.50", priceCurrency: "USD", availability: "https://schema.org/InStock", url: "https://www.pickstall.store/@maya/morning-flow" },
        brand: { "@type": "Brand", name: "Maya Yoga" },
      },
      { "@type": "BreadcrumbList", itemListElement: [{ item: "https://www.pickstall.store/@maya" }, { item: "https://www.pickstall.store/@maya/morning-flow" }] },
    ]);
    expect(schema[0]).not.toHaveProperty("aggregateRating");
  });

  it("uses whole units for zero-decimal currencies", () => {
    expect(schemaPrice(1500, "jpy")).toBe("1500");
    expect(schemaPrice(999, "usd")).toBe("9.99");
    expect(schemaPrice(0, "usd")).toBe("0.00");
  });

  it("marks courses as a Course, and shows ratings and availability honestly", () => {
    const course = { ...product, type: "course", rating: { average: 4.666, count: 3 } } as PublicProduct;
    expect(productPageSchema(store, course, { buyable: false, rating: course.rating })[0]).toMatchObject({
      "@type": "Course",
      provider: { "@type": "Person", name: "Maya Yoga" },
      hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online" },
      offers: { availability: "https://schema.org/OutOfStock" },
      aggregateRating: { ratingValue: "4.7", reviewCount: 3 },
    });
  });

  it("cannot close the script tag, whatever the creator writes", () => {
    const sneaky = { ...product, title: "</script><script>alert(1)</script>" } as PublicProduct;
    expect(jsonLdText(productPageSchema(store, sneaky, { buyable: true }))).not.toMatch(/<\/?script/i);
  });

  it("builds the canonical paths", () => {
    expect(storePath("maya")).toBe("/@maya");
    expect(storePath("maya", "morning-flow")).toBe("/@maya/morning-flow");
  });
});

describe("AI sources in attribution", () => {
  it("name AI assistants, and keep Gemini apart from Google search", () => {
    expect(sourceOfHost("chatgpt.com")).toBe("chatgpt");
    expect(sourceOfHost("perplexity.ai")).toBe("perplexity");
    expect(sourceOfHost("gemini.google.com")).toBe("gemini");
    expect(sourceOfHost("google.com")).toBe("google");
    expect(sourceOfHost("claude.ai")).toBe("claude");
    expect(sourceOfHost("copilot.microsoft.com")).toBe("copilot");
  });

  it("turn ChatGPT's utm_source=chatgpt.com into its name, and keep other UTM sources as written", () => {
    expect(attributionFrom({ source: "chatgpt.com" }, "pickstall.store")?.source).toBe("chatgpt");
    expect(attributionFrom({ referrer: "https://www.perplexity.ai/search" }, "pickstall.store")?.source).toBe("perplexity");
    expect(attributionFrom({ source: "newsletter" }, "pickstall.store")?.source).toBe("newsletter");
    expect(attributionFrom({ source: "myblog.example" }, "pickstall.store")?.source).toBe("myblog.example");
  });
});

describe("content pages and files for answer engines", () => {
  it("date each content page and only claim profiles that exist", () => {
    expect(webPageSchema("Pricing", "/pricing")).toMatchObject({ "@type": "WebPage", url: "https://www.pickstall.store/pricing", dateModified: CONTENT_UPDATED });
    expect(CONTENT_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const sameAs = (organizationSchema() as { sameAs?: string[] }).sameAs ?? [];
    expect(sameAs.every((url) => url.startsWith("https://"))).toBe(true);
  });

  it("serve the full text in /llms-full.txt, linked from /llms.txt", async () => {
    const full = await llmsFull().text();
    expect(full.startsWith("# Pickstall")).toBe(true);
    for (const item of FAQ) expect(full).toContain(`### ${item.q}`);
    for (const page of COMPARE_PAGES) expect(full).toContain(page.source.url);
    expect(llmsFull().headers.get("Content-Type")).toContain("text/markdown");
    expect(await llms().text()).toContain("https://www.pickstall.store/llms-full.txt");
  });

  it("welcome the newer AI crawlers, with the private paths still blocked", () => {
    for (const bot of ["DuckAssistBot", "meta-externalagent", "MistralAI-User", "Amazonbot", "Applebot"]) expect(AI_CRAWLERS).toContain(bot);
    const rules = robots().rules;
    const ai = (Array.isArray(rules) ? rules : [rules]).find((rule) => Array.isArray(rule.userAgent) && rule.userAgent.includes("DuckAssistBot"));
    expect(ai?.allow).toContain("/llms-full.txt");
    expect(ai?.disallow).toContain("/dashboard");
  });
});

describe("IndexNow pings", () => {
  it("send only our own pages, once each", () => {
    expect(indexNowPayload("key-12345678", ["/@maya", "/@maya", "/@maya/morning-flow", "//evil.example", "https://evil.example"])).toEqual({
      host: "www.pickstall.store",
      key: "key-12345678",
      keyLocation: "https://www.pickstall.store/indexnow.txt",
      urlList: ["https://www.pickstall.store/@maya", "https://www.pickstall.store/@maya/morning-flow"],
    });
    expect(indexNowPayload("key-12345678", [])).toBeNull();
  });

  it("stay off without a key or outside production", () => {
    expect(indexNowEnabled()).toBe(false);
  });
});
