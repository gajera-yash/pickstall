import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/guards";

/** Log in and sign up, shown while the session is checked and to visitors without one. */
export function GuestActions() {
  return (
    <>
      <Button asChild variant="ghost">
        <Link href="/login">Log in</Link>
      </Button>
      <Button asChild>
        <Link href="/signup">Claim your stall</Link>
      </Button>
    </>
  );
}

/** Signed-in visitors get a way back into the app instead of the sign-up buttons. */
export async function NavActions() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return <GuestActions />;
  return (
    <Button asChild>
      <Link href="/dashboard">
        Go to dashboard
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  );
}
