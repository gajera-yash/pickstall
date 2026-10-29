import { Suspense } from "react";

import { AccountForm } from "@/components/dashboard/account-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/lib/auth/actions";
import { requireCreator } from "@/lib/auth/guards";
import { getProfile } from "@/lib/auth/profiles";

// Settings > Account (PRD F8): name, email, phone, sign out, delete account request.
export default function AccountSettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <AccountContent />
    </Suspense>
  );
}

async function AccountContent() {
  const { user, store } = await requireCreator("/dashboard/settings/account");
  const profile = await getProfile(user.id);

  return (
    <>
      <AccountForm email={user.email ?? ""} initial={{ fullName: profile?.fullName ?? store.name, phone: profile?.phone ?? null }} />

      <Card>
        <CardHeader>
          <h2 className="font-display text-h3">Sign out</h2>
          <p className="text-sm text-mute">Sign out of Pickstall on this device.</p>
        </CardHeader>
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-h3">Delete account</h2>
            <Badge variant="soon">Coming soon</Badge>
          </div>
          <p className="text-sm text-mute">
            You will be able to ask us to delete your account and your store here. Until then, email support from the address you sign in with.
          </p>
        </CardHeader>
      </Card>
    </>
  );
}
