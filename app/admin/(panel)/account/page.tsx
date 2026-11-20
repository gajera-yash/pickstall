import { Suspense } from "react";

import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { AdminPageTitle } from "@/components/admin/admin-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin/guard";

// Admin account (D-108): change the password. Other sessions of this admin are signed out.
export default function AdminAccountPage() {
  return (
    <>
      <AdminPageTitle title="Account" description="Your admin password. Changing it signs out your other admin sessions." />
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-md rounded-lg" />}>
        <AccountContent />
      </Suspense>
    </>
  );
}

async function AccountContent() {
  const admin = await requireAdmin();
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:p-6">
      <p className="text-sm text-mute">
        Signed in as <span className="font-semibold text-ink">{admin.username}</span>
      </p>
      <ChangePasswordForm />
    </div>
  );
}
