import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_NAME } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { signOutAdmin } from "@/lib/admin/login-actions";
import { requireAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = { title: `Admin | ${APP_NAME}`, robots: { index: false, follow: false } };

// The platform admin area (D-104). The whole shell renders only after requireAdmin(): without an
// admin session (D-107) the visitor is sent to /admin/login. Every page checks again on its own.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh bg-bg">
      <Suspense fallback={<Skeleton className="m-6 h-96 rounded-lg" />}>
        <AdminShell>{children}</AdminShell>
      </Suspense>
    </div>
  );
}

async function AdminShell({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <Link href="/admin" className="font-display text-h4">
            {APP_NAME} Admin
          </Link>
          <span className="flex items-center gap-3">
            <span className="truncate text-sm text-mute">{admin.username}</span>
            <form action={signOutAdmin}>
              <Button type="submit" variant="secondary" size="sm">
                Sign out
              </Button>
            </form>
          </span>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-6 lg:w-48 lg:shrink-0">
          <AdminNav />
        </div>
        <main id="main" className="flex min-w-0 flex-1 flex-col gap-6">
          {children}
        </main>
      </div>
    </>
  );
}
