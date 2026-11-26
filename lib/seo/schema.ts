import { APP_NAME } from "@/lib/config";
import { CONTACT_EMAIL, ONE_LINER, PRICES, SITE_URL } from "@/lib/seo/site-facts";

// schema.org structured data (JSON-LD) for Pickstall's public pages (D-134). Pure: built from the
// site facts, so it always matches the visible text. Types and fields follow schema.org and Google's
// structured data guides (Organization, SoftwareApplication, FAQPage, BreadcrumbList).

type Json = Record<string, unknown>;

export function organizationSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/brand/pickstall-logo.webp`,
    description: ONE_LINER,
    email: CONTACT_EMAIL,
  };
}

export function softwareApplicationSchema(): Json {
  const offer = (name: string, price: number) => ({ "@type": "Offer", name, price: price.toFixed(2), priceCurrency: "USD", category: "subscription", url: `${SITE_URL}/pricing` });
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: APP_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: ONE_LINER,
    offers: [offer("Starter", PRICES.starter), offer("Pro", PRICES.pro)],
  };
}

export function faqSchema(items: readonly { q: string; a: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
  };
}

export function breadcrumbSchema(items: readonly { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: `${SITE_URL}${item.path}` })),
  };
}

/** JSON for a <script type="application/ld+json">, safe to put in HTML (no closing tag can appear). */
export function jsonLdText(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
