import { ArrowLeft, CalendarCheck, Download, Link2, Mail, PlayCircle, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { createCoachingAndEdit } from "@/lib/coaching/actions";
import { createCourseAndEdit } from "@/lib/courses/actions";
import { createProductAndEdit } from "@/lib/products/actions";
import { cn } from "@/lib/utils";

type ProductType = { id: string; title: string; description: string; icon: LucideIcon; live: boolean };

// Type registry for the picker (D-012, DESIGN.md 10.8). Digital product is the Phase 1 type; its
// editor ships with R3, so for now every card says what it will be and none leads to an empty page.
const TYPES: ProductType[] = [
  { id: "digital", title: "Digital product", description: "PDFs, templates, presets, audio or any file. Or a private link.", icon: Download, live: true },
  { id: "course", title: "Course", description: "Video lessons in modules, with progress for each student.", icon: PlayCircle, live: true },
  { id: "coaching", title: "Coaching call", description: "Sell 1:1 time with booking built in.", icon: CalendarCheck, live: true },
  { id: "membership", title: "Membership", description: "Monthly access to content and a community.", icon: UsersRound, live: false },
  { id: "emails", title: "Collect emails", description: "A free lead magnet that grows your list.", icon: Mail, live: false },
  { id: "link", title: "Link", description: "Send buyers to any page: a booking tool, a group or a site.", icon: Link2, live: false },
];

export default function NewProductPage() {
  return (
    <>
      <Link href="/dashboard/products" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Products
      </Link>
      <PageHeader title="What do you want to sell?" description="Pick a product type. You can change the details any time." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <TypePicker />
      </Suspense>
    </>
  );
}

async function TypePicker() {
  await requireCreator("/dashboard/products/new");
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {TYPES.map(({ id, title, description, icon: Icon, live }) => (
        <li key={id}>
          {live ? (
            <form action={id === "course" ? createCourseAndEdit : id === "coaching" ? createCoachingAndEdit : createProductAndEdit} className="h-full">
              <Button
                type="submit"
                variant="secondary"
                className="group h-full w-full flex-col items-stretch justify-start gap-3 rounded-lg border border-line p-5 text-left font-normal whitespace-normal transition-all duration-(--dur-fast) not-disabled:hover:border-blue not-disabled:hover:bg-blue-soft not-disabled:hover:ring-1 not-disabled:hover:ring-blue focus-visible:border-blue focus-visible:ring-1 focus-visible:ring-blue"
              >
                <TypeCardBody title={title} description={description} Icon={Icon} live badge="Start" />
              </Button>
            </form>
          ) : (
            <div className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface p-5 opacity-80">
              <TypeCardBody title={title} description={description} Icon={Icon} live={false} badge="Coming soon" />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function TypeCardBody({ title, description, Icon, live, badge }: { title: string; description: string; Icon: LucideIcon; live: boolean; badge: string }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span aria-hidden="true" className={cn("flex size-12 items-center justify-center rounded-full transition-colors duration-(--dur-fast)", live ? "bg-blue-soft text-blue group-hover:bg-blue group-hover:text-on-blue" : "bg-bg-subtle text-mute")}>
          <Icon className="size-6" />
        </span>
        <Badge variant={live ? "live" : "soon"}>{badge}</Badge>
      </div>
      <h2 className="font-display text-h3">{title}</h2>
      <p className="text-sm text-mute">{description}</p>
    </>
  );
}
