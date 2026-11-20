import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_NAME } from "@/lib/config";
import { currentAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = { title: `Admin sign in | ${APP_NAME}`, robots: { index: false, follow: false } };

// Admin sign-in (D-107): a username and password, apart from creator accounts. Already signed in:
// straight to the admin area.
export default function AdminLoginPage() {
  return (
    <AuthShell>
      <AuthHeading>{APP_NAME} admin</AuthHeading>
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-lg" />}>
        <LoginContent />
      </Suspense>
    </AuthShell>
  );
}

async function LoginContent() {
  if (await currentAdmin()) redirect("/admin");
  return <AdminLoginForm />;
}
