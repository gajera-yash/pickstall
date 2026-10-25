import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LoginForm, type LoginNotice } from "@/components/auth/login-form";
import { LoginFormSkeleton } from "@/components/auth/login-form-skeleton";
import { Wordmark } from "@/components/brand/wordmark";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth/redirect";
import { APP_NAME } from "@/lib/config";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: `Sign in | ${APP_NAME}` };

const NOTICES: Record<string, LoginNotice> = {
  callback: {
    title: "Google sign-in didn't finish",
    description: "Try again, or use your email.",
  },
  google: {
    title: "Couldn't start Google sign-in",
    description: "Use your email instead.",
  },
};

const linkClass = "text-blue underline underline-offset-4 hover:text-blue-hover";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-5 py-10">
      <Card className="w-full max-w-md gap-4">
        <CardHeader className="gap-3">
          <Wordmark />
          <h1 className="font-display text-h1">Sign in to {APP_NAME}</h1>
        </CardHeader>
        <CardContent>
          {/* Query params are request data, so the form renders behind a boundary (Cache Components). */}
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginFormWithParams searchParams={searchParams} />
          </Suspense>
        </CardContent>
        <CardFooter>
          <p>
            By continuing you agree to the{" "}
            <Link href="/terms" className={linkClass}>
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className={linkClass}>
              Privacy Policy
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}

async function LoginFormWithParams({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const error = first(params.error);

  return (
    <LoginForm
      next={safeNextPath(first(params.next))}
      notice={error ? (NOTICES[error] ?? null) : null}
      googleEnabled={publicEnv.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"}
    />
  );
}
