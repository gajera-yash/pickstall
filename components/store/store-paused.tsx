import { PauseCircle } from "lucide-react";
import Link from "next/link";

import { cardStyle, resolveTheme, StoreFrame } from "@/components/store/store-theme";
import type { StoreDoc } from "@/lib/db/collections";

/**
 * What visitors see while a store is paused after its free trial (D-072): the creator's own theme, no
 * products and no checkout. Nothing about plans or billing is shown to buyers. Earlier purchases stay
 * in the buyer's library.
 */
export function StorePaused({ storeName, theme: storeTheme }: { storeName: string; theme: StoreDoc["theme"] }) {
  const theme = resolveTheme(storeTheme);
  const { preset } = theme;
  return (
    <StoreFrame theme={theme}>
      <section aria-labelledby="paused-title" className="flex w-full flex-col items-center gap-4 p-8 text-center" style={cardStyle(theme)}>
        <PauseCircle aria-hidden="true" className="size-12" style={{ color: preset.muted }} />
        <h1 id="paused-title" className="font-display text-h2 break-words" style={{ fontWeight: preset.displayWeight }}>
          {storeName} is taking a short break
        </h1>
        <p className="max-w-sm" style={{ color: preset.muted }}>
          This store isn&apos;t taking orders right now. If you bought something here before, it&apos;s safe in your library.
        </p>
        <Link href="/library" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
          Open my library
        </Link>
      </section>
    </StoreFrame>
  );
}
