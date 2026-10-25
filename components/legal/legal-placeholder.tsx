import Link from "next/link";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { Wordmark } from "@/components/brand/wordmark";
import { APP_NAME } from "@/lib/config";

/**
 * Stand-in for a legal page. The real text is written and reviewed before any real payment is taken
 * (PHASE1_PLAN.md go/no-go), so this page says plainly that it is not ready yet.
 */
export function LegalPlaceholder({ title }: { title: string }) {
  return (
    <AuthShell>
      <AuthHeading wordmark={<Wordmark />}>{title}</AuthHeading>
      <p className="text-center text-mute">
        This page isn&apos;t ready yet. {APP_NAME} is in private testing, and the full {title} will be published before
        any real payments are taken.
      </p>
      <Link href="/login" className="self-center text-blue underline underline-offset-4 hover:text-blue-hover">
        Back to sign in
      </Link>
    </AuthShell>
  );
}
