import { CalendarCheck, ChevronRight, ImageIcon, Library, PlayCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { formatDay } from "@/components/dashboard/orders-ui";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/guards";
import { listPurchases, type Purchase } from "@/lib/library/queries";
import { safeImageSrc } from "@/lib/media/media";

// Buyer library (PRD F13): the purchases made with the email this buyer signed in with.
export default function LibraryPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1">Your library</h1>
        <p className="text-mute">Everything you bought, in one place.</p>
      </div>
      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryContent />
      </Suspense>
    </>
  );
}

async function LibraryContent() {
  const user = await requireUser("/library");
  const purchases = user.email ? await listPurchases(user.email) : [];

  if (purchases.length === 0) {
    return (
      <EmptyState icon={Library} title="No purchases yet">
        Purchases show up here when you sign in with the same email you used at checkout ({user.email}).
      </EmptyState>
    );
  }

  const courses = purchases.filter((purchase) => purchase.kind === "course").length;
  return (
    <>
      <p className="-mt-2 text-sm text-mute">
        {purchases.length} {purchases.length === 1 ? "purchase" : "purchases"}
        {courses > 0 && ` · ${courses} ${courses === 1 ? "course" : "courses"}`}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {purchases.map((purchase) => (
          <li key={purchase.orderId}>
            <PurchaseCard purchase={purchase} />
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * One purchase (D-070): cover, title, store and date, its state, a course's progress and the next
 * action. An open course goes straight to the player; everything else to its library page, which
 * explains refunds, ended access and downloads.
 */
function PurchaseCard({ purchase }: { purchase: Purchase }) {
  const cover = safeImageSrc(purchase.coverUrl);
  const course = purchase.kind === "course";
  const open = purchase.status === "paid" && purchase.available && !purchase.accessEnded;
  const progress = course ? purchase.progress : null;
  const done = progress !== null && progress.total > 0 && progress.done >= progress.total;
  const href = course && open ? `/library/${purchase.orderId}/learn` : `/library/${purchase.orderId}`;
  const coaching = purchase.kind === "coaching";
  const action = !open ? "View details" : coaching ? "View booking" : !course ? "Open" : done ? "Review course" : progress && progress.done > 0 ? "Continue" : "Start course";

  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface transition-[border-color,box-shadow] duration-(--dur-fast) hover:border-field-border hover:shadow-popover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-glow"
    >
      <span aria-hidden="true" className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-blue-soft text-blue">
        {cover ? (
          // The creator's own upload or https link, so next/image's fixed remote hosts cannot be used.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-full object-cover" />
        ) : course ? (
          <PlayCircle className="size-10" />
        ) : coaching ? (
          <CalendarCheck className="size-10" />
        ) : (
          <ImageIcon className="size-10" />
        )}
      </span>
      <span className="flex flex-1 flex-col gap-3 p-4">
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant={course || coaching ? "live" : "draft"}>{course ? "Course" : coaching ? "Coaching call" : "Digital product"}</Badge>
          {purchase.status === "refunded" ? (
            <Badge variant="draft">Refunded</Badge>
          ) : !purchase.available ? (
            <Badge variant="testMode">Unavailable</Badge>
          ) : purchase.accessEnded ? (
            <Badge variant="draft">Access ended</Badge>
          ) : null}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold break-words">{purchase.title}</span>
          <span className="truncate text-sm text-mute">
            {purchase.storeName}
            {coaching && purchase.call ? ` · Call on ${callDay(purchase.call)}` : purchase.paidAt && ` · ${formatDay(purchase.paidAt)}`}
          </span>
        </span>
        {progress && progress.total > 0 && (
          <span className="flex flex-col gap-1.5">
            <Progress value={progress.done} max={progress.total} aria-label="Course progress" aria-valuetext={`${progress.done} of ${progress.total} lessons done`} />
            <span className="text-xs text-mute tabular-nums">
              {progress.done} of {progress.total} lessons done
            </span>
          </span>
        )}
        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold text-blue">
          {action}
          <ChevronRight aria-hidden="true" className="size-4 transition-transform duration-(--dur-fast) group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}

/** The call's date in the zone the buyer booked from (or the coach's), like "Nov 23, 2026". */
function callDay(call: NonNullable<Purchase["call"]>): string {
  const zone = call.buyerTimeZone ?? call.coachTimeZone ?? "UTC";
  try {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: zone }).format(call.start);
  } catch {
    return formatDay(call.start);
  }
}

function LibrarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
      {[0, 1].map((key) => (
        <div key={key} className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
