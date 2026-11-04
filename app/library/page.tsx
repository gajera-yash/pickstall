import { ChevronRight, ImageIcon, Library } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { formatDay } from "@/components/dashboard/orders-ui";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/guards";
import { listPurchases } from "@/lib/library/queries";
import { safeImageSrc } from "@/lib/media/media";

// Buyer library (PRD F13): the purchases made with the email this buyer signed in with.
export default function LibraryPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1">Your library</h1>
        <p className="text-mute">Everything you bought, in one place.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-56 w-full rounded-lg" />}>
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

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {purchases.map((purchase) => {
        const cover = safeImageSrc(purchase.coverUrl);
        return (
          <li key={purchase.orderId}>
            <Link href={`/library/${purchase.orderId}`} className="flex min-h-[84px] items-center gap-4 px-4 py-3 transition-colors duration-(--dur-fast) hover:bg-bg-subtle">
              <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-blue-soft text-blue">
                {cover ? (
                  // The creator's own upload or https link, so next/image's fixed remote hosts cannot be used.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
                ) : (
                  <ImageIcon className="size-6" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">{purchase.title}</span>
                <span className="truncate text-sm text-mute">
                  {purchase.storeName} · {formatDay(purchase.paidAt)}
                </span>
              </span>
              {purchase.status === "refunded" ? (
                <Badge variant="draft">Refunded</Badge>
              ) : !purchase.available ? (
                <Badge variant="testMode">Unavailable</Badge>
              ) : purchase.kind === "course" ? (
                // A course whose access period is over says so; an open one is labelled as a course.
                purchase.accessEnded ? <Badge variant="draft">Access ended</Badge> : <Badge variant="live">Course</Badge>
              ) : null}
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-mute" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
