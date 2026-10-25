import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/guards";
import { APP_NAME } from "@/lib/config";

// Placeholder until the marketing site and tenant routing land (Block B).
// Shows the session state so email-code sign-in can be checked by hand.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 p-4">
      <h1 className="text-3xl font-bold">{APP_NAME}</h1>
      <p>Setup in progress.</p>
      <Suspense fallback={<p>Checking your session...</p>}>
        <SessionStatus />
      </Suspense>
    </main>
  );
}

async function SessionStatus() {
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Button asChild className="self-start">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p>Signed in as {user.email ?? "your account"}.</p>
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </div>
  );
}
