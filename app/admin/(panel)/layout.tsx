import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { AdminMobileNav, AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin/guard";
import { signOutAdmin } from "@/lib/admin/login-actions";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Admin | ${APP_NAME}`, robots: { index: false, follow: false } };

// The platform admin area (D-104, full screen since D-116): a full-height sidebar with the sections
// and the signed-in admin, and the content across the rest of the screen. Phones get a menu button.
// The shell renders only after requireAdmin(); every page checks again on its own.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-1 bg-bg-subtle">
      <Suspense fallback={<Skeleton className="m-6 h-96 w-full rounded-lg" />}>
        <AdminShell>{children}</AdminShell>
      </Suspense>
    </div>
  );
}

async function AdminShell({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const signOut = (
    <form action={signOutAdmin}>
      <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
        <LogOut aria-hidden="true" className="size-4" />
        Sign out
      </Button>
    </form>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-3 py-5 lg:flex">
        <Link href="/admin" className="px-3 font-display text-h4">
          {APP_NAME} <span className="text-blue">Admin</span>
        </Link>
        <AdminNav />
        <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
          <p className="truncate px-3 text-sm text-mute">
            Signed in as <span className="font-semibold text-ink">{admin.username}</span>
          </p>
          {signOut}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 lg:hidden">
          <Link href="/admin" className="font-display text-h4">
            {APP_NAME} <span className="text-blue">Admin</span>
          </Link>
          <AdminMobileNav username={admin.username} signOut={signOut} />
        </header>
        <main id="main" className="flex w-full min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </>
  );
}
