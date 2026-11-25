"use client";

import { LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

/**
 * A small spinner inside a nav link while the page it opens is loading (D-128), so a click always
 * answers at once, even when the server is slow. Must be rendered inside a next/link <Link>.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden={!pending} className={cn("ml-auto flex size-4 shrink-0 items-center justify-center", className)}>
      {pending && (
        <>
          <LoaderCircle className="size-4 animate-spin text-blue motion-reduce:animate-none" />
          <span className="sr-only">Loading</span>
        </>
      )}
    </span>
  );
}

/** A nav icon that turns into a spinner while its page loads (the phone's bottom bar). */
export function PendingIcon({ icon: Icon, className }: { icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <LoaderCircle aria-hidden="true" className={cn(className, "animate-spin motion-reduce:animate-none")} /> : <Icon aria-hidden={true} className={className} />;
}
