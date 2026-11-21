import { ArrowLeft, CalendarDays, Clock, Download, ExternalLink, Hash, KeyRound, Package, PlayCircle, ShieldCheck, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { CopyButton } from "@/components/dashboard/details-sheet";
import { formatDay } from "@/components/dashboard/orders-ui";
import { CallCard } from "@/components/library/call-card";
import { PurchaseCover, StoreChip } from "@/components/library/purchase-cover";
import { ReviewForm } from "@/components/library/review-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/guards";
import { findPurchase, type Purchase } from "@/lib/library/queries";
import { licenseOfOrder, type OrderLicense } from "@/lib/licenses/queries";
import { isUuid } from "@/lib/media/media";
import { findOwnReview } from "@/lib/reviews/queries";
import { cn } from "@/lib/utils";

const PROBLEMS: Record<string, string> = {
  limit: "You have used all of your opens for this purchase. Contact the creator if you need more.",
  refunded: "This purchase was refunded, so access has been removed.",
  unavailable: "The creator has taken this down. Contact them if you need it.",
  slow: "Slow down a little, then try again.",
  error: "Couldn't open that. Check your connection and try again.",
  not_found: "We couldn't open that purchase.",
};

// One purchase (PRD F13, DESIGN.md 10.6): a cover, the title and creator, the one thing to do with
// it (open, open the course, see the call), then details, the license key and a review. The delivery
// link is only handed out by the POST route after every check; it is never in this page. A course
// opens in the course player (D-057), which checks access again on every load.
export default function PurchasePage({ params, searchParams }: PageProps<"/library/[orderId]">) {
  return (
    <>
      <Link
        href="/library"
        className="inline-flex items-center gap-1 self-start rounded-md text-sm font-semibold text-mute hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-glow"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        My library
      </Link>
      <Suspense fallback={<PurchaseSkeleton />}>
        <PurchaseContent params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PurchaseContent({ params, searchParams }: Pick<PageProps<"/library/[orderId]">, "params" | "searchParams">) {
  const [{ orderId }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/library/${orderId}`);
  if (!isUuid(orderId) || !user.email) notFound();

  const purchase = await findPurchase(user.email, orderId);
  if (!purchase) notFound();
  // The buyer's own review of this product (D-106), shown again so it can be changed.
  const review = purchase.status === "paid" ? await findOwnReview(user.email, orderId).catch(() => null) : null;
  // The order's license key (D-114); the purchase above is already this email's own.
  const license = await licenseOfOrder(orderId).catch(() => null);

  const problem = typeof query.problem === "string" ? PROBLEMS[query.problem] : undefined;
  const refunded = purchase.status === "refunded";
  const used = purchase.downloadLimit ? `${Math.min(purchase.accessCount, purchase.downloadLimit)} of ${purchase.downloadLimit}` : null;
  const kindLabel = purchase.kind === "course" ? "Course" : purchase.kind === "coaching" ? "Coaching call" : "Digital product";
  const access =
    purchase.kind === "course"
      ? purchase.accessEndsAt
        ? `${purchase.accessEnded ? "Ended" : "Until"} ${formatDay(purchase.accessEndsAt)}`
        : "Lifetime"
      : purchase.kind === "coaching"
        ? "One call"
        : "Lifetime";
  const status = refunded
    ? { label: "Refunded", variant: "draft" as const }
    : !purchase.available
      ? { label: "Unavailable", variant: "testMode" as const }
      : purchase.accessEnded
        ? { label: "Access ended", variant: "draft" as const }
        : { label: "Paid", variant: "live" as const };

  return (
    <div className="flex flex-col gap-6">
      {problem && (
        <Alert variant="error">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}

      <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
        <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <PurchaseCover coverUrl={purchase.coverUrl} title={purchase.title} kind={purchase.kind} className="aspect-video w-full md:aspect-auto md:min-h-72" iconClassName="size-9" />
          <div className="flex flex-col gap-5 p-5 sm:p-7">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-bg-subtle px-2.5 py-1 text-xs font-semibold text-ink">{kindLabel}</span>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <h1 className="font-display text-h1 break-words">{purchase.title}</h1>
              {purchase.storeSlug ? (
                <Link href={`/@${purchase.storeSlug}`} className="self-start rounded-md hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-glow">
                  <StoreChip name={purchase.storeName} prefix="by" avatarUrl={purchase.storeAvatarUrl} />
                </Link>
              ) : (
                <StoreChip name={purchase.storeName} prefix="by" avatarUrl={purchase.storeAvatarUrl} />
              )}
            </div>
            <PrimaryAction purchase={purchase} refunded={refunded} used={used} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {license && <LicenseCard license={license} />}
          {/* No reviews for a product the creator took down (D-106): there is no page to show them on. */}
          {!refunded && purchase.available && (
            <Card className="gap-4">
              <ReviewForm orderId={purchase.orderId} initial={review} />
            </Card>
          )}
          {(refunded || !purchase.available) && (
            <Card className="gap-2">
              <h2 className="font-display text-h4">Need help with this purchase?</h2>
              <p className="text-sm text-mute">Contact {purchase.storeName} through their store page. They can answer questions about refunds and access.</p>
            </Card>
          )}
        </div>

        <aside aria-label="Purchase details" className="flex flex-col gap-4">
          <Card className="gap-4">
            <h2 className="font-display text-h4">Details</h2>
            <dl className="flex flex-col divide-y divide-line text-sm">
              <DetailRow icon={CalendarDays} label="Bought" value={formatDay(purchase.paidAt)} />
              <DetailRow icon={Package} label="Type" value={kindLabel} />
              <DetailRow icon={Clock} label="Access" value={access} />
              {used && <DetailRow icon={Download} label="Opens used" value={used} />}
              <DetailRow icon={Hash} label="Order" value={purchase.orderId.slice(0, 8).toUpperCase()} mono />
            </dl>
          </Card>
          {purchase.storeSlug && (
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/@${purchase.storeSlug}`}>
                <Store aria-hidden="true" className="size-4" />
                Visit {purchase.storeName}
              </Link>
            </Button>
          )}
          <p className="flex items-start gap-2 text-xs text-mute">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mint" />
            Your links are private and expire after a short time. Open them from here whenever you need them.
          </p>
        </aside>
      </div>
    </div>
  );
}

/** The one thing to do with this purchase: open it, open the course, see the call, or why not. */
function PrimaryAction({ purchase, refunded, used }: { purchase: Purchase; refunded: boolean; used: string | null }) {
  if (purchase.kind === "coaching" && purchase.call) {
    return <CallCard orderId={purchase.orderId} call={purchase.call} storeName={purchase.storeName} refunded={refunded} />;
  }
  if (refunded) return <Notice>This purchase was refunded, so access has been removed.</Notice>;
  if (!purchase.available) return <Notice>This product isn&apos;t available right now. Contact the creator.</Notice>;
  if (purchase.kind === "course") {
    if (purchase.accessEnded && purchase.accessEndsAt) {
      return <Notice>Your access to this course ended on {formatDay(purchase.accessEndsAt)}. Contact the creator if you need more time.</Notice>;
    }
    const progress = purchase.progress;
    const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    const label = progress && progress.done > 0 ? (percent >= 100 ? "Review course" : "Continue course") : "Start course";
    return (
      <div className="mt-auto flex flex-col gap-4">
        {progress && progress.total > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-mute">
                {progress.done} of {progress.total} lessons done
              </span>
              <span className="font-semibold tabular-nums">{percent}%</span>
            </div>
            <Progress value={percent} max={100} aria-label="Course progress" aria-valuetext={`${percent}% complete`} />
          </div>
        )}
        <Button asChild size="lg" className="w-full sm:w-auto sm:self-start">
          <Link href={`/library/${purchase.orderId}/learn`}>
            <PlayCircle aria-hidden="true" className="size-5" />
            {label}
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <form action={`/library/${purchase.orderId}/open`} method="post" className="mt-auto flex flex-col gap-2">
      <Button type="submit" size="lg" className="w-full sm:w-auto sm:self-start">
        <ExternalLink aria-hidden="true" className="size-5" />
        Open your purchase
      </Button>
      <p className="text-sm text-mute">{used ? `${used} opens used.` : "Open it as many times as you like."}</p>
    </form>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="mt-auto rounded-md border border-line bg-bg-subtle px-4 py-3 text-sm text-mute">{children}</p>;
}

function DetailRow({ icon: Icon, label, value, mono = false }: { icon: LucideIcon; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="inline-flex items-center gap-2 text-mute">
        <Icon aria-hidden="true" className="size-4" />
        {label}
      </dt>
      <dd className={cn("text-right font-semibold", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

/** The buyer's license key (D-114), or why it no longer works. */
function LicenseCard({ license }: { license: OrderLicense }) {
  return (
    <Card className="gap-3">
      <h2 className="flex items-center gap-2 font-display text-h4">
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-blue-soft text-blue">
          <KeyRound className="size-4" />
        </span>
        Your license key
      </h2>
      {license.status === "active" ? (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 rounded-md bg-bg-subtle px-3 py-2 font-mono text-sm break-all">{license.key}</code>
          <CopyButton value={license.key} label="Copy key" />
        </div>
      ) : (
        <p className="text-sm text-mute">{license.status === "refunded" ? "This purchase was refunded, so the key no longer works." : "The creator has turned this key off. Contact them if you think this is a mistake."}</p>
      )}
    </Card>
  );
}

function PurchaseSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading your purchase</span>
      <div className="grid overflow-hidden rounded-lg border border-line bg-surface md:grid-cols-2">
        <Skeleton className="aspect-video w-full rounded-none md:aspect-auto md:min-h-72" />
        <div className="flex flex-col gap-3 p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-6 h-12 w-48" />
        </div>
      </div>
    </div>
  );
}
