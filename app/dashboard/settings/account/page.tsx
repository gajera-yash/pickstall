import { Suspense } from "react";

import { AccountData } from "@/components/account/account-data";
import { AccountForm } from "@/components/dashboard/account-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/lib/auth/actions";
import { requireCreator } from "@/lib/auth/guards";
import { getProfile } from "@/lib/auth/profiles";

// Settings > Account (PRD F8, D-074): name, email, phone, sign out, download my data, delete account.
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

      <AccountData hasStore />
    </>
  );
}
