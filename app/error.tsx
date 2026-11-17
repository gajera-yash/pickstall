"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

// Error state for every page outside the dashboard (D-075): public stores, products, checkout, library.
// Reports to Sentry when configured; visitors see plain words and a retry, never internals.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <AuthShell>
      <AuthHeading>Something went wrong</AuthHeading>
      <p className="text-center text-mute">Please try again. If it keeps happening, come back in a few minutes.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Home page</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
