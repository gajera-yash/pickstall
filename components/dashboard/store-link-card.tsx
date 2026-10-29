"use client";

import { Check, Copy, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CopyState = "idle" | "copied" | "failed";

/**
 * Store link card (DESIGN.md 10.2, 9.14): the link as a monospace chip with a Copy button and the
 * store status. The copy result is announced to screen readers.
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
    <Card className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-h3">Your store link</h2>
        {isPublished ? <Badge variant="live">Live</Badge> : <Badge variant="draft">Draft</Badge>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex min-h-11 min-w-0 flex-1 items-center rounded-md bg-bg-subtle px-3 font-mono text-sm break-all text-ink">{link}</p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={copyLink} className="flex-1 sm:flex-none">
            {copy === "copied" ? <Check aria-hidden="true" className="text-mint" /> : <Copy aria-hidden="true" />}
            {copy === "copied" ? "Copied" : "Copy"}
          </Button>
          <Button asChild variant="ghost" className="flex-1 sm:flex-none">
            <Link href="/dashboard/settings#store-link">
              <Pencil aria-hidden="true" />
              Change
            </Link>
          </Button>
        </div>
      </div>

      <p aria-live="polite" className="text-sm text-mute">
        {copy === "copied"
          ? "Link copied. Paste it in your bio or send it to your audience."
          : copy === "failed"
            ? "Couldn't copy. Select the link and copy it yourself."
            : isPublished
              ? "Share this link anywhere: your bio, posts and messages."
              : "Your store is a draft. The link starts working when you publish."}
      </p>
    </Card>
  );
}
