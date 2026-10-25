import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/redirect";
import { APP_NAME } from "@/lib/config";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: `Sign in | ${APP_NAME}` };

const NOTICES: Record<string, string> = {
  callback: "Google sign-in didn't finish. Try again, or use your email.",
  google: "Couldn't start Google sign-in. Use your email instead.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-4">
      <h1 className="text-3xl font-bold">Sign in to {APP_NAME}</h1>
      {/* searchParams is request data, so it renders behind a boundary (Cache Components). */}
      <Suspense fallback={<p>Loading...</p>}>
        <LoginFormWithParams searchParams={searchParams} />
      </Suspense>
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
