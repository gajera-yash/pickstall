import { hostname } from "node:os";

import type { NextConfig } from "next";

import { devAllowedOrigins } from "./lib/dev-hosts";
import { contentSecurityPolicy, PAGE_CSP_SOURCE, securityHeaders } from "./lib/security/headers";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Lets the dev server work when opened as 127.0.0.1, from an IDE preview or from another device on
  // the network (D-041). Only used by `next dev`.
  allowedDevOrigins: devAllowedOrigins(hostname(), process.env.DEV_ALLOWED_HOSTS),
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders(isDev) },
      { source: PAGE_CSP_SOURCE, headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) }] },
    ];
  },
  // Public store URLs are /@username and /@username/product (D-010). An app/@username folder would
  // be a parallel route, so the pages live under /s and these rewrites map the public URLs to them.
  async rewrites() {
    return [
      { source: "/@:username", destination: "/s/:username" },
      { source: "/@:username/:product", destination: "/s/:username/:product" },
      { source: "/@:username/:product/:page", destination: "/s/:username/:product/:page" },
    ];
  },
  partialPrefetching: true,
  experimental: {
    turbopackPluginRuntimeStrategy: "childProcesses",
  },
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
