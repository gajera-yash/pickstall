"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { StorePage } from "@/components/store/store-page";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PublicProduct, PublicStore } from "@/lib/stores/public";
import { cn } from "@/lib/utils";

/** The widths the preview pretends to be, scaled down to fit. */
const DEVICE_WIDTH = { phone: 390, desktop: 1280 } as const;
type Device = keyof typeof DEVICE_WIDTH;

/**
 * A live preview of the real public store page (D-062): the same StorePage and layout the public
 * page renders, at phone or desktop width, scaled down to fit its box. It is not interactive
 * (`inert`), so links in it never navigate away from the dashboard.
 */
export function LiveStorePreview({ store, products, maxHeight, className }: { store: PublicStore; products: PublicProduct[]; maxHeight?: number; className?: string }) {
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
  const height = Math.min(pageHeight * scale, maxHeight ?? Number.POSITIVE_INFINITY);

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
      <div ref={box} aria-hidden="true" className="relative w-full overflow-hidden rounded-lg border border-line bg-bg-subtle" style={{ height: height || 240 }}>
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
