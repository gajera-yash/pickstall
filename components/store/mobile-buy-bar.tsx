"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Phone buy bar (D-068): once the product page's own Buy button has scrolled up out of view, a bar
 * with the price and the button stays at the bottom of the screen. Hidden on wide pages (@3xl),
 * where the buy box itself stays in view. It only repeats what the page already shows.
 */
export function MobileBuyBar({ targetId, style, children }: { targetId: string; style: CSSProperties; children: ReactNode }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      // Only after scrolling past it, not while it is still below the screen.
      if (entry) setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  return (
    <div
      data-slot="mobile-buy-bar"
      aria-hidden={!shown}
      inert={!shown}
      className="fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-(--dur-base) motion-reduce:transition-none data-[shown=false]:translate-y-full @3xl:hidden"
      data-shown={shown}
      style={style}
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">{children}</div>
    </div>
  );
}
