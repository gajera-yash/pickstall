import { ArrowLeft, CalendarCheck, Download, Link2, Mail, PlayCircle, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireCreator } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";

type ProductType = { id: string; title: string; description: string; icon: LucideIcon; live: boolean };

// Type registry for the picker (D-012, DESIGN.md 10.8). Digital product is the Phase 1 type; its
// editor ships with R3, so for now every card says what it will be and none leads to an empty page.
const TYPES: ProductType[] = [
  { id: "digital", title: "Digital product", description: "PDFs, templates, presets, audio or any file. Or a private link.", icon: Download, live: true },
  { id: "course", title: "Course", description: "Video lessons in modules, with progress for each student.", icon: PlayCircle, live: false },
  { id: "coaching", title: "Coaching call", description: "Sell 1:1 time with booking built in.", icon: CalendarCheck, live: false },
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
          <div
            className={cn(
              "flex h-full flex-col gap-3 rounded-lg border bg-surface p-5",
              live ? "border-blue ring-1 ring-blue" : "border-line opacity-80",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span aria-hidden="true" className={cn("flex size-12 items-center justify-center rounded-full", live ? "bg-blue text-on-blue" : "bg-bg-subtle text-mute")}>
                <Icon className="size-6" />
              </span>
              <Badge variant="soon">{live ? "Editor arrives next" : "Coming soon"}</Badge>
            </div>
            <h2 className="font-display text-h3">{title}</h2>
            <p className="text-sm text-mute">{description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
