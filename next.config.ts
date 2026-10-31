import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Public store URLs are /@username and /@username/product (D-010). An app/@username folder would
  // be a parallel route, so the pages live under /s and these rewrites map the public URLs to them.
  async rewrites() {
    return [
      { source: "/@:username", destination: "/s/:username" },
      { source: "/@:username/:product", destination: "/s/:username/:product" },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
