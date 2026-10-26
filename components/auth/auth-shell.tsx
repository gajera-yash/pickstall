import type { ReactNode } from "react";

/**
 * Page frame for login, signup and the username step (DESIGN.md 10, white theme D-007): a white page,
 * one centered column, no card. `top` holds the wizard progress bar when there is one.
 */
export function AuthShell({ children, top }: { children: ReactNode; top?: ReactNode }) {
  return (
    <main id="main" className="flex min-h-dvh flex-1 flex-col items-center px-5 py-8 sm:py-12">
      {top}
      <div className="flex w-full max-w-sm flex-1 flex-col justify-center gap-6 pb-12">{children}</div>
    </main>
  );
}

/** Wordmark and page title, centered at the top of the column. */
export function AuthHeading({ children, wordmark }: { children: ReactNode; wordmark: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {wordmark}
      <h1 className="font-display text-h1">{children}</h1>
    </div>
  );
}
