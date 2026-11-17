"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import "./globals.css";

// Last-resort error page (D-075): replaces the whole page when even the root layout fails. Reports the
// error to Sentry (when configured) and offers a reload. No error details are shown to visitors.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-bg-subtle p-6 font-sans text-ink">
        <main className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="font-display text-h1">Something went wrong</h1>
          <p className="text-mute">We&apos;ve been told about it. Please try again in a moment.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={reset} className="h-11 rounded-md bg-blue px-5 font-semibold text-on-blue hover:bg-blue-hover">
              Try again
            </button>
            {/* A full page load: the router itself may be what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="flex h-11 items-center rounded-md border border-input px-5 font-semibold">
              Home page
            </a>
          </div>
          {error.digest && <p className="text-xs text-mute">Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
