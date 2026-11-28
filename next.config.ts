import { hostname } from "node:os";

import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

import { devAllowedOrigins } from "./lib/dev-hosts";
import { contentSecurityPolicy, PAGE_CSP_SOURCE, securityHeaders, STORE_CSP_SOURCE } from "./lib/security/headers";

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
      { source: STORE_CSP_SOURCE, headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy(isDev, { pixels: true }) }] },
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

// Sentry (D-075). Source maps are uploaded only when SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT
// are set (in CI or on Vercel); without them the build still works. Browser reports go to /monitoring.
export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/uploading/bundler-plugin-options/

  org: "pickstall",

  project: "pickstall",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
