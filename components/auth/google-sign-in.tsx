"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/auth/actions";

/**
 * "or" divider plus "Continue with Google" (DESIGN.md 10.7), on login and signup. New Google users
 * without a store pick a username next (D-020); returning ones go to `next`.
 */
export function GoogleSignIn({ next }: { next: string }) {
  return (
    <>
      <div aria-hidden="true" className="flex items-center gap-3 text-sm text-mute">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <GoogleButton />
      </form>
    </>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="lg" className="w-full" loading={pending}>
      Continue with Google
    </Button>
  );
}
