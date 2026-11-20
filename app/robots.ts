import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";

// Stores and products are public; dashboards, buyer pages, checkout and the API are not for search.
export default function robots(): MetadataRoute.Robots {
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/library", "/account", "/api/", "/auth/", "/u/", "/mock-pay", "/welcome", "/certificates/", "/*/checkout", "/*/thank-you"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
