import { Suspense } from "react";

import { AdminPageTitle } from "@/components/admin/admin-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/admin/guard";

// Admin account (D-109): the admin username and password live in the server environment.
export default function AdminAccountPage() {
  return (
    <>
      <AdminPageTitle title="Account" description="Your admin sign-in." />
      <Suspense fallback={<Skeleton className="h-40 w-full max-w-xl rounded-lg" />}>
        <AccountContent />
      </Suspense>
    </>
  );
}

async function AccountContent() {
  const admin = await requireAdmin();
  return (
    <div className="flex max-w-xl flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-sm sm:p-6">
      <p>
        Signed in as <span className="font-semibold">{admin.username}</span>. Sessions last 8 hours.
      </p>
      <p className="text-mute">
        To change the username or password, edit <code className="font-mono">ADMIN_USERNAME</code> and <code className="font-mono">ADMIN_PASSWORD</code> in Vercel (Settings, Environment
        Variables) and redeploy. Every admin session is signed out when they change.
      </p>
    </div>
  );
}
