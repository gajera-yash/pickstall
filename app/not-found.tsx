import Link from "next/link";

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";

// 404 for any unknown page, unknown store or unpublished product (D-075). Plain and helpful.
export default function NotFound() {
  return (
    <AuthShell>
      <AuthHeading>Page not found</AuthHeading>
      <p className="text-center text-mute">This page doesn&apos;t exist, or the store or product isn&apos;t public right now.</p>
      <Link href="/" className="self-center font-semibold text-blue underline underline-offset-4 hover:text-blue-hover">
        Go to the home page
      </Link>
    </AuthShell>
  );
}
