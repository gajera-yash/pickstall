import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/guards";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Your library | ${APP_NAME}`, robots: { index: false } };

// Buyer area (PRD F13): a calm white page with the logo and who is signed in.
export default function LibraryLayout({ children }: LayoutProps<"/library">) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-subtle">
      <header className="flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 md:px-8">
        <Wordmark className="h-8" priority />
        <Suspense fallback={null}>
          <Who />
        </Suspense>
      </header>
      {/* A course player (D-057) marks itself data-layout="wide" for the room of two columns. */}
      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 has-[[data-layout=wide]]:max-w-6xl md:px-6">
        {children}
      </main>
    </div>
  );
}

async function Who() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-56 truncate text-sm text-mute sm:block">{user.email}</span>
      <Link href="/account" className="text-sm font-semibold text-ink underline-offset-4 hover:underline">
        Account
      </Link>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm" className="h-10">
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </Button>
      </form>
    </div>
  );
}
