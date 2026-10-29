import { LifeBuoy, Mail, Palette } from "lucide-react";
import Link from "next/link";

import { StorePreview, type StorePreviewData } from "@/components/dashboard/store-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SUPPORT_EMAIL } from "@/lib/config";

/**
 * Right column of My Store (reference docs/ui-reference/dashboard.webp): a live phone preview of the
 * public store with its status and "Customize design", then the help card.
 */
export function StorePreviewCard({ data, isPublished }: { data: StorePreviewData; isPublished: boolean }) {
  return (
    <Card id="store-preview" className="scroll-mt-24 gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-h3">Store preview</h2>
        {isPublished ? <Badge variant="live">Live</Badge> : <Badge variant="draft">Draft</Badge>}
      </div>
      <StorePreview data={data} className="max-w-[300px] [&>div]:min-h-[480px]" />
      <Button asChild variant="secondary" size="lg" className="border-blue text-blue not-disabled:hover:bg-blue-soft">
        <Link href="/dashboard?tab=design">
          <Palette aria-hidden="true" className="size-5" />
          Customize design
        </Link>
      </Button>
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
