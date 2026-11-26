import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";
import { AI_CRAWLERS } from "@/lib/seo/site-facts";

// Stores and products are public; dashboards, buyer pages, checkout and the API are not for search.
const PRIVATE = ["/dashboard", "/admin", "/library", "/account", "/api/", "/auth/", "/u/", "/mock-pay", "/welcome", "/certificates/", "/*/checkout", "/*/thank-you"];

export default function robots(): MetadataRoute.Robots {
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: ["/", "/llms.txt"], disallow: PRIVATE },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
