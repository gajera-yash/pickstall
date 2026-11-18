import { ArrowLeft, ExternalLink, ImageIcon, PlayCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { formatDay } from "@/components/dashboard/orders-ui";
import { CallCard } from "@/components/library/call-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/guards";
import { findPurchase } from "@/lib/library/queries";
import { isUuid, safeImageSrc } from "@/lib/media/media";

const PROBLEMS: Record<string, string> = {
  limit: "You have used all of your opens for this purchase. Contact the creator if you need more.",
  refunded: "This purchase was refunded, so access has been removed.",
  unavailable: "The creator has taken this down. Contact them if you need it.",
  slow: "Slow down a little, then try again.",
  error: "Couldn't open that. Check your connection and try again.",
  not_found: "We couldn't open that purchase.",
};

// One purchase (PRD F13): details and the button that opens the delivery link. The link itself is
// only handed out by the POST route after every check; it is never in this page. A course opens in
// the course player instead (D-057), which checks access again on every load.
export default function PurchasePage({ params, searchParams }: PageProps<"/library/[orderId]">) {
  return (
    <>
      <Link href="/library" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Your library
      </Link>
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
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

  const problem = typeof query.problem === "string" ? PROBLEMS[query.problem] : undefined;
  const cover = safeImageSrc(purchase.coverUrl);
  const refunded = purchase.status === "refunded";
  const used = purchase.downloadLimit ? `${Math.min(purchase.accessCount, purchase.downloadLimit)} of ${purchase.downloadLimit} opens used` : null;

  return (
    <Card className="gap-5">
      {problem && (
        <Alert variant="error">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-blue-soft text-blue">
          {cover ? (
            // The creator's own upload or https link, so next/image's fixed remote hosts cannot be used.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-8" />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-h2 break-words">{purchase.title}</h2>
          <p className="text-mute">
            {purchase.storeSlug ? <Link href={`/@${purchase.storeSlug}`} className="underline underline-offset-4">{purchase.storeName}</Link> : purchase.storeName} · Bought {formatDay(purchase.paidAt)}
          </p>
        </div>
      </div>

      {purchase.kind === "coaching" && purchase.call ? (
        <CallCard orderId={purchase.orderId} call={purchase.call} storeName={purchase.storeName} refunded={refunded} />
      ) : refunded ? (
        <p className="rounded-md bg-bg-subtle px-4 py-3 text-mute">This purchase was refunded, so access has been removed.</p>
      ) : !purchase.available ? (
        <p className="rounded-md bg-bg-subtle px-4 py-3 text-mute">This product isn&apos;t available right now. Contact the creator.</p>
      ) : purchase.kind === "course" ? (
        purchase.accessEnded && purchase.accessEndsAt ? (
          <p className="rounded-md bg-bg-subtle px-4 py-3 text-mute">Your access to this course ended on {formatDay(purchase.accessEndsAt)}. Contact the creator if you need more time.</p>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <Button asChild size="lg">
              <Link href={`/library/${purchase.orderId}/learn`}>
                <PlayCircle aria-hidden="true" className="size-5" />
                Open course
              </Link>
            </Button>
            <p className="text-sm text-mute">{purchase.accessEndsAt ? `Access until ${formatDay(purchase.accessEndsAt)}` : "Lifetime access"}</p>
          </div>
        )
      ) : (
        <form action={`/library/${purchase.orderId}/open`} method="post" className="flex flex-col items-start gap-2">
          <Button type="submit" size="lg">
            <ExternalLink aria-hidden="true" className="size-5" />
            Open your purchase
          </Button>
          {used && <p className="text-sm text-mute">{used}</p>}
        </form>
      )}
    </Card>
  );
}
