"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { StorePage } from "@/components/store/store-page";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PublicProduct, PublicStore } from "@/lib/stores/public";
import { cn } from "@/lib/utils";

/** The widths the preview pretends to be, scaled down to fit. */
const DEVICE_WIDTH = { phone: 390, desktop: 1280 } as const;
type Device = keyof typeof DEVICE_WIDTH;

/**
 * A live preview of the real public store page (D-062): the same StorePage and layout the public
 * page renders, at phone or desktop width, scaled down to fit its box. It is not interactive
 * (`inert`), so links in it never navigate away from the dashboard. With `scroll`, a page taller than
 * `maxHeight` scrolls inside the box (Store design, D-125), so every part of the page can be seen;
 * without it the box is cut at `maxHeight`.
 */
export function LiveStorePreview({
  store,
  products,
  maxHeight,
  scroll = false,
  className,
}: {
  store: PublicStore;
  products: PublicProduct[];
  /** Pixels, or a CSS length such as "calc(100dvh - 15rem)" (only with `scroll`). */
  maxHeight?: number | string;
  scroll?: boolean;
  className?: string;
}) {
  const [device, setDevice] = useState<Device>("phone");
  const box = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setBoxWidth(box.current?.clientWidth ?? 0);
      setPageHeight(page.current?.scrollHeight ?? 0);
    });
    if (box.current) observer.observe(box.current);
    if (page.current) observer.observe(page.current);
    return () => observer.disconnect();
  }, []);

  const width = DEVICE_WIDTH[device];
  const scale = boxWidth > 0 ? Math.min(1, boxWidth / width) : 0;
  const scaled = pageHeight * scale;
  const height = typeof maxHeight === "string" ? `min(${Math.max(scaled, 240)}px, ${maxHeight})` : Math.min(scaled, maxHeight ?? Number.POSITIVE_INFINITY) || 240;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ToggleGroup type="single" variant="segment" size="sm" aria-label="Preview size" value={device} onValueChange={(value) => value && setDevice(value as Device)} className="self-center">
        <ToggleGroupItem value="phone">
          <Smartphone aria-hidden="true" />
          Phone
        </ToggleGroupItem>
        <ToggleGroupItem value="desktop">
          <Monitor aria-hidden="true" />
          Desktop
        </ToggleGroupItem>
      </ToggleGroup>
      <div ref={box} aria-hidden="true" className={cn("relative w-full rounded-lg border border-line bg-bg-subtle", scroll ? "overflow-x-hidden overflow-y-auto overscroll-contain" : "overflow-hidden")} style={{ height }}>
        {/* The scaled page is positioned absolutely; this spacer gives the box its scroll height. */}
        {scroll && <div style={{ height: scaled }} />}
        {/* Until the box is measured (after the page's script loads), a placeholder instead of a blank box (D-090). */}
        {scale === 0 && (
          <div className="absolute inset-0 flex flex-col items-center gap-3 p-6">
            <Skeleton className="size-14 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-2 h-24 w-full rounded-md" />
          </div>
        )}
        <div
          ref={page}
          inert
          className="absolute top-0 left-1/2 origin-top"
          style={{ width, transform: `translateX(-50%) scale(${scale})`, visibility: scale > 0 ? "visible" : "hidden" }}
        >
          <StorePage store={store} products={products} preview />
        </div>
      </div>
    </div>
  );
}
