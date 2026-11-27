import { APP_NAME } from "@/lib/config";
import { cleanText } from "@/lib/products/text";
import { priceDecimals, unitsPerWhole } from "@/lib/products/money";
import { payableCents } from "@/lib/products/pricing";
import type { RatingSummary } from "@/lib/reviews/rules";
import { SITE_URL } from "@/lib/seo/site-facts";
import type { PublicProduct, PublicStore } from "@/lib/stores/public";

// schema.org structured data (JSON-LD) for creator store and product pages (GEO, D-135). Pure.
// Built only from public fields that the page already shows. Creator text is cleaned to one line and
// length-limited here; `jsonLdText` escapes <, > and & so it cannot close the script tag. Never
// emails (an "email" social link is left out), payment account ids, video ids or buyer data.

type Json = Record<string, unknown>;

export const SCHEMA_NAME_MAX = 120;
export const SCHEMA_TEXT_MAX = 300;

/** Creator text as one clean, short line, or undefined when nothing is left. */
export function schemaText(value: string | null | undefined, max = SCHEMA_TEXT_MAX): string | undefined {
  if (!value) return undefined;
  // Keep line breaks through cleanText, then turn them into spaces ("Line one. Line two.").
  const text = cleanText(value, { multiline: true }).replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** The public address of a store or product (the canonical URL). */
export function storePath(storeSlug: string, productSlug?: string): string {
  return productSlug ? `/@${storeSlug}/${productSlug}` : `/@${storeSlug}`;
}

/** An amount in store units as the decimal string schema.org expects ("12.50", "1500"). */
export function schemaPrice(cents: number, currency: string): string {
  return (cents / unitsPerWhole(currency)).toFixed(priceDecimals(currency));
}

const absolute = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  if (/^https:\/\//i.test(url)) return url;
  return url.startsWith("/") ? `${SITE_URL}${url}` : undefined;
};

const drop = (data: Json): Json => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

function creator(store: PublicStore): Json {
  const sameAs = store.socialLinks.filter((link) => link.kind !== "email" && /^https:\/\//i.test(link.url)).map((link) => link.url);
  return drop({
    "@type": "Person",
    name: schemaText(store.name, SCHEMA_NAME_MAX),
    url: `${SITE_URL}${storePath(store.slug)}`,
    description: schemaText(store.bio),
    image: absolute(store.avatarUrl),
    sameAs: sameAs.length ? sameAs : undefined,
  });
}

/** The store page: a ProfilePage about the creator, and the list of their published products. */
export function storePageSchema(store: PublicStore, products: readonly Pick<PublicProduct, "slug" | "title">[]): Json[] {
  const url = `${SITE_URL}${storePath(store.slug)}`;
  const profile = { "@context": "https://schema.org", "@type": "ProfilePage", url, name: schemaText(store.name, SCHEMA_NAME_MAX), mainEntity: creator(store), isPartOf: { "@type": "WebSite", name: APP_NAME, url: SITE_URL } };
  if (!products.length) return [profile];
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${schemaText(store.name, SCHEMA_NAME_MAX)} products`,
    itemListElement: products.map((product, index) => ({ "@type": "ListItem", position: index + 1, name: schemaText(product.title, SCHEMA_NAME_MAX), url: `${SITE_URL}${storePath(store.slug, product.slug)}` })),
  };
  return [profile, list];
}

/** A product page: a Course for courses, else a Product, with its real price as an Offer, and breadcrumbs. */
export function productPageSchema(store: PublicStore, product: PublicProduct, options: { buyable: boolean; rating?: RatingSummary | null }): Json[] {
  const url = `${SITE_URL}${storePath(store.slug, product.slug)}`;
  const offer = {
    "@type": "Offer",
    url,
    price: schemaPrice(payableCents(product), store.currency),
    priceCurrency: store.currency.toUpperCase(),
    availability: options.buyable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  };
  const rating = options.rating && options.rating.count > 0 ? { "@type": "AggregateRating", ratingValue: options.rating.average.toFixed(1), reviewCount: options.rating.count, bestRating: 5, worstRating: 1 } : undefined;
  const common = {
    "@context": "https://schema.org",
    name: schemaText(product.title, SCHEMA_NAME_MAX),
    description: schemaText(product.description) ?? `${schemaText(product.title, SCHEMA_NAME_MAX)} by ${schemaText(store.name, SCHEMA_NAME_MAX)}`,
    url,
    image: absolute(product.coverUrl),
    offers: offer,
    aggregateRating: rating,
  };
  const main =
    product.type === "course"
      ? drop({ ...common, "@type": "Course", provider: creator(store), hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online" } })
      : drop({ ...common, "@type": "Product", brand: { "@type": "Brand", name: schemaText(store.name, SCHEMA_NAME_MAX) } });
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: schemaText(store.name, SCHEMA_NAME_MAX), item: `${SITE_URL}${storePath(store.slug)}` },
      { "@type": "ListItem", position: 2, name: schemaText(product.title, SCHEMA_NAME_MAX), item: url },
    ],
  };
  return [main, crumbs];
}
