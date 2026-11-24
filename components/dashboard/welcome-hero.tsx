"use client";

import { BarChart3, Check, ExternalLink, Image as ImageIcon, Link2, MousePointer2, Share2, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { dayPart } from "@/lib/dashboard/greeting";

const noSubscribe = () => () => {};

type Props = { name: string; storeUrl: string; ready: boolean; publicPath: string | null };

/**
 * Welcome card at the top of My Store (reference docs/ui-reference/dashboard.webp): a greeting for
 * the viewer's own time of day, one line of guidance, "View my store" and "Share link", and a small
 * illustration of a store page. The greeting is computed in the browser (the server does not know
 * the viewer's time zone); the server renders "Welcome".
 */
export function WelcomeHero({ name, storeUrl, ready, publicPath }: Props) {
  const part = useSyncExternalStore(noSubscribe, () => dayPart(new Date().getHours()), () => null);
  const [shared, setShared] = useState(false);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url: storeUrl });
        return;
      }
      await navigator.clipboard.writeText(storeUrl);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    } catch {
      // The user closed the share sheet; nothing to do.
    }
  };

  return (
    <section
      aria-labelledby="welcome-title"
      className="relative isolate flex overflow-hidden rounded-lg border border-line bg-blue-soft px-5 py-7 sm:px-8 sm:py-8"
    >
      {/* Soft shapes behind the text: decoration only. */}
      <span aria-hidden="true" className="absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-surface/60" />
      <span aria-hidden="true" className="absolute -bottom-28 left-1/3 -z-10 size-64 rounded-full bg-surface/40" />

      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:max-w-[52%]">
        <h1 id="welcome-title" className="font-display text-h1 break-words text-ink">
          {part ? `Good ${part}, ${name}` : `Welcome, ${name}`}
        </h1>
        <p className="text-body-l text-mute">
          {ready ? "Your store is live. Share your link and keep an eye on your sales." : "Let's get your store ready. Follow the steps below to start selling."}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={publicPath ?? "/dashboard/design"} {...(publicPath ? { target: "_blank", rel: "noopener" } : {})}>
              View my store
              <ExternalLink aria-hidden="true" className="size-4" />
            </Link>
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={share} className="border-transparent bg-surface">
            {shared ? <Check aria-hidden="true" className="size-4 text-mint" /> : <Share2 aria-hidden="true" className="size-4" />}
            {shared ? "Link copied" : "Share link"}
          </Button>
        </div>
        <p aria-live="polite" className="sr-only">
          {shared ? "Your store link was copied." : ""}
        </p>
      </div>

      <HeroIllustration />
    </section>
  );
}

/** A miniature store page with floating tiles, drawn with tokens and lucide icons (no image file). */
function HeroIllustration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-6 hidden w-[44%] max-w-md items-center justify-center lg:flex">
      <div className="relative h-[180px] w-[280px]">
        {/* Browser window */}
        <div className="absolute inset-x-6 top-2 bottom-0 flex flex-col gap-3 rounded-t-lg border border-line bg-surface p-4 shadow-popover">
          <div className="flex items-center justify-between">
            <span className="h-2 w-20 rounded-full bg-bg-subtle" />
            <span className="flex gap-1">
              <span className="size-1.5 rounded-full bg-blue" />
              <span className="size-1.5 rounded-full bg-yellow" />
              <span className="size-1.5 rounded-full bg-mint" />
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-blue text-on-blue">
              <UserRound className="size-6" />
            </span>
            <span className="flex flex-1 flex-col gap-1.5">
              <span className="h-2.5 w-24 rounded-full bg-blue-soft" />
              <span className="h-2 w-16 rounded-full bg-bg-subtle" />
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((tile) => (
              <span key={tile} className="flex h-12 items-center justify-center rounded-md bg-blue-soft text-blue">
                <ImageIcon className="size-5" />
              </span>
            ))}
          </div>
        </div>

        {/* Floating tiles */}
        <span className="absolute top-8 -left-4 flex size-11 items-center justify-center rounded-full bg-blue text-on-blue shadow-popover">
          <Link2 className="size-5" />
        </span>
        <span className="absolute bottom-6 -left-2 flex size-11 items-center justify-center rounded-md bg-yellow text-on-yellow shadow-popover">
          <BarChart3 className="size-5" />
        </span>
        <span className="absolute -top-3 right-14 flex size-10 items-center justify-center rounded-md bg-surface text-blue shadow-popover">
          <BarChart3 className="size-5" />
        </span>
        <span className="absolute top-12 -right-4 flex size-11 items-center justify-center rounded-md bg-surface text-blue shadow-popover">
          <UserRound className="size-5" />
        </span>
        <MousePointer2 className="absolute right-2 bottom-2 size-7 fill-yellow text-on-yellow" />
        <Sparkles className="absolute -top-1 left-10 size-4 text-surface" />
        <Sparkles className="absolute right-0 bottom-16 size-4 text-surface" />
      </div>
    </div>
  );
}
