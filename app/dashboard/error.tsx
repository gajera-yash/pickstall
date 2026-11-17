"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// Error state for every dashboard page (CLAUDE.md section 5): plain words, no internals, a retry.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error); // D-075: reported when Sentry is configured
  }, [error]);

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="error">
        <AlertTitle>Couldn&apos;t load this page</AlertTitle>
        <AlertDescription>Check your connection and try again.</AlertDescription>
      </Alert>
      <Button type="button" variant="secondary" className="self-start" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
