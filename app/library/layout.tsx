import type { Metadata } from "next";

import { BuyerHeader } from "@/components/library/buyer-header";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Your library | ${APP_NAME}`, robots: { index: false } };

// Buyer area (PRD F13, DESIGN.md 10.6): a calm page with the buyer's top bar, their purchases and the
// course player. Content is a centered column; the course player uses the full width.
export default function LibraryLayout({ children }: LayoutProps<"/library">) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-subtle">
      <BuyerHeader />
      {/* A course player (D-057) marks itself data-layout="wide" for the room of two columns. */}
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 has-[[data-layout=wide]]:max-w-6xl sm:py-8 md:px-6">
        {children}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-mute md:px-6">
          <span>Secure links expire after a short time. Your purchases stay here on any device.</span>
          <span>
            Powered by <span className="font-semibold text-ink">{APP_NAME}</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
