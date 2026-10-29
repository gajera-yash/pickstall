"use client";

import { ArrowRight, Check, Copy, Info, Link2, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CopyState = "idle" | "copied" | "failed";

/**
 * Store link card (reference docs/ui-reference/dashboard.webp): the public link with Copy and
 * Customize, and while the store is a draft a notice that points at the steps to publish it.
 * The copy result is announced to screen readers.
 */
export function StoreLinkCard({ link, isPublished }: { link: string; isPublished: boolean }) {
  const [copy, setCopy] = useState<CopyState>("idle");

  useEffect(() => {
    if (copy === "idle") return;
    const timer = setTimeout(() => setCopy("idle"), 2500);
    return () => clearTimeout(timer);
  }, [copy]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://${link}`);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <Card className="gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-h3">Your store link</h2>
          {isPublished ? <Badge variant="live">Live</Badge> : <Badge variant="draft">Draft</Badge>}
        </div>
        <p className="text-sm text-mute">
          {isPublished ? "This is your public link. Share it in your bio, posts and messages." : "This is your public link. It will start working when you publish your store."}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <p className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md border border-line bg-bg-subtle px-4 text-base font-medium break-all text-ink">
          <Link2 aria-hidden="true" className="size-5 shrink-0 text-mute" />
          {link}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="button" variant="secondary" onClick={copyLink} className="h-12">
            {copy === "copied" ? <Check aria-hidden="true" className="text-mint" /> : <Copy aria-hidden="true" />}
            {copy === "copied" ? "Copied" : "Copy"}
          </Button>
          <Button asChild variant="secondary" className="h-12">
            <Link href="/dashboard/settings">
              <Pencil aria-hidden="true" />
              Customize
            </Link>
          </Button>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {copy === "copied" ? "Link copied." : copy === "failed" ? "Couldn't copy. Select the link and copy it yourself." : ""}
      </p>
      {copy === "failed" && <p className="-mt-2 text-sm text-danger">Couldn&apos;t copy. Select the link and copy it yourself.</p>}

      {!isPublished && (
        <div className="flex flex-col gap-2 rounded-md border border-blue/25 bg-blue-soft px-4 py-3 text-sm sm:flex-row sm:items-center">
          <p className="flex flex-1 items-start gap-2 text-ink">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-blue" />
            Your store is in draft mode. Publish it to make it public.
          </p>
          <Link href="#get-started" className="inline-flex items-center gap-1 self-start font-semibold text-blue hover:text-blue-hover sm:self-auto">
            Publish store
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      )}
    </Card>
  );
}
