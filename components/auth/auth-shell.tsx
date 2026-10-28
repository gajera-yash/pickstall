import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { APP_TAGLINE } from "@/lib/config";

/**
 * Page frame for login, signup, the username step and legal stand-ins (D-026, reference
 * docs/ui-reference/username.webp): logo and tagline on a subtle page, then one white card.
 * `top` holds the wizard progress bar; `footer` sits under the card (switch account, terms).
 */
export function AuthShell({ children, top, footer }: { children: ReactNode; top?: ReactNode; footer?: ReactNode }) {
  return (
    <main id="main" className="flex min-h-dvh flex-1 flex-col items-center bg-bg-subtle px-4 py-8 sm:py-12">
      <div className="flex w-full max-w-md flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <Wordmark className="h-12 sm:h-14" priority />
          <p className="text-sm font-medium text-mute">{APP_TAGLINE}</p>
        </div>
        {top}
        <div className="flex flex-col gap-6 rounded-lg bg-surface px-5 py-7 sm:px-8 sm:py-8">
          {children}
        </div>
        {footer && <div className="flex flex-col gap-3 text-center">{footer}</div>}
      </div>
    </main>
  );
}

/** Page title, centered at the top of the card. */
export function AuthHeading({ children }: { children: ReactNode }) {
  return <h1 className="text-center font-display text-h1">{children}</h1>;
}
