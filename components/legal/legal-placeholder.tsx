import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { APP_NAME } from "@/lib/config";

/**
 * Stand-in for a legal page. The real text is written and reviewed before any real payment is taken
 * (PHASE1_PLAN.md go/no-go), so this page says plainly that it is not ready yet.
 */
export function LegalPlaceholder({ title }: { title: string }) {
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-5 py-10">
      <Card className="w-full max-w-md gap-4">
        <CardHeader className="gap-3">
          <Wordmark />
          <h1 className="font-display text-h1">{title}</h1>
        </CardHeader>
        <CardContent className="gap-4">
          <p className="text-mute">
            This page isn&apos;t ready yet. {APP_NAME} is in private testing, and the full {title} will be published
            before any real payments are taken.
          </p>
          <Link href="/login" className="self-start text-blue underline underline-offset-4 hover:text-blue-hover">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
