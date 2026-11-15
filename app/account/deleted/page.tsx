import type { Metadata } from "next";
import Link from "next/link";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Account deleted | ${APP_NAME}`, robots: { index: false } };

// Shown after a successful account deletion (D-074). The session is already gone.
export default function AccountDeletedPage() {
  return (
    <AuthShell>
      <AuthHeading>Your account has been deleted</AuthHeading>
      <p className="text-center text-mute">
        You have been signed out everywhere. Thank you for trying {APP_NAME}. If you change your mind, you can create a new account at any time.
      </p>
      <Link href="/" className="self-center font-semibold text-blue underline underline-offset-4 hover:text-blue-hover">
        Back to the home page
      </Link>
    </AuthShell>
  );
}
