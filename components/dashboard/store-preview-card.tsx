"use client";

import { Expand, LifeBuoy, Mail, Palette } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useDesignDraft } from "@/components/dashboard/design-draft";
import { LiveStorePreview } from "@/components/dashboard/live-store-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SUPPORT_EMAIL } from "@/lib/config";
import type { PublicProduct, PublicStore } from "@/lib/stores/public";

/**
 * Right column of My Store (reference docs/ui-reference/dashboard.webp, D-062): the one live preview
 * of the public store, at phone or desktop size. While the creator edits Page design it shows the
 * unsaved design ("Unsaved changes"); "Expand" opens it large.
 */
export function StorePreviewCard({ store, products, isPublished }: { store: PublicStore; products: PublicProduct[]; isPublished: boolean }) {
  const draft = useDesignDraft();
  const [expanded, setExpanded] = useState(false);
  const shown: PublicStore = draft ? { ...store, theme: { preset: draft.design.themePreset, accent: draft.design.accent, custom: draft.design.custom } } : store;

  return (
    <Card id="store-preview" className="scroll-mt-24 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-h3">Store preview</h2>
        <div className="flex items-center gap-1.5">
          {draft?.unsaved && <Badge variant="testMode">Unsaved changes</Badge>}
          {isPublished ? <Badge variant="live">Live</Badge> : <Badge variant="draft">Draft</Badge>}
        </div>
      </div>
      <LiveStorePreview store={shown} products={products} maxHeight={560} />
      <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
        <Button type="button" variant="secondary" onClick={() => setExpanded(true)} className="sm:flex-1 xl:flex-none">
          <Expand aria-hidden="true" className="size-4" />
          Expand preview
        </Button>
        <Button asChild variant="secondary" className="border-blue text-blue sm:flex-1 xl:flex-none not-disabled:hover:bg-blue-soft">
          <Link href="/dashboard/design">
            <Palette aria-hidden="true" className="size-4" />
            Customize design
          </Link>
        </Button>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="sm:max-w-[min(1100px,calc(100vw-4rem))]">
          <DialogHeader>
            <DialogTitle>Store preview</DialogTitle>
            <DialogDescription>{draft?.unsaved ? "Your unsaved design. Save it in Store design to publish it." : "How your store page looks to visitors."}</DialogDescription>
          </DialogHeader>
          <LiveStorePreview store={shown} products={products} maxHeight={640} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function HelpCard() {
  return (
    <Card className="gap-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
          <LifeBuoy className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-h4">Need help?</h2>
          <p className="text-sm text-mute">Write to us and a real person will answer, usually within a day.</p>
        </div>
      </div>
      <Button asChild variant="secondary" className="bg-blue-soft/50 border-transparent text-blue">
        <a href={`mailto:${SUPPORT_EMAIL}`}>
          <Mail aria-hidden="true" className="size-4" />
          Contact support
        </a>
      </Button>
    </Card>
  );
}
