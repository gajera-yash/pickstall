import { Star } from "lucide-react";
import { Suspense } from "react";

import { formatDay, ListCard } from "@/components/dashboard/orders-ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReviewRowActions } from "@/components/dashboard/review-row-actions";
import { Stars } from "@/components/store/stars";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { listStoreReviews } from "@/lib/reviews/queries";
import { roundRating } from "@/lib/reviews/rules";

// Reviews (D-106): what buyers say about the store's products. Reviews show on the product page at
// once; the creator can hide or delete one. Only the signed-in creator's store.
export default function ReviewsPage() {
  return (
    <>
      <PageHeader title="Reviews" description="What buyers say about your products. New reviews show on the product page at once; hide any you don't want there." />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <ReviewsContent />
      </Suspense>
    </>
  );
}

async function ReviewsContent() {
  const { store } = await requireUnlockedCreator("/dashboard/reviews");
  const reviews = await listStoreReviews(store.id);
  const shown = reviews.filter((review) => review.status === "published");
  const average = shown.length ? roundRating(shown.reduce((sum, review) => sum + review.rating, 0) / shown.length) : 0;

  if (reviews.length === 0) {
    return (
      <EmptyState icon={Star} title="No reviews yet">
        Buyers can rate a product from their library after buying it. Their reviews show here and on the product page.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-4">
        <Stars rating={average} size="size-5" />
        <span className="font-display text-h3 tabular-nums">{average.toFixed(1)}</span>
        <span className="text-sm text-mute">
          from {shown.length.toLocaleString("en")} {shown.length === 1 ? "review" : "reviews"} on your pages
          {reviews.length > shown.length ? ` · ${reviews.length - shown.length} hidden` : ""}
        </span>
      </div>
      <ListCard>
        <ul className="divide-y divide-line">
          {reviews.map((review) => (
            <li key={review.id} className="flex items-start gap-3 px-4 py-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <Stars rating={review.rating} size="size-3.5" />
                  <span className="text-sm font-semibold">{review.buyerName}</span>
                  <span className="text-xs text-mute">
                    on {review.productTitle} · {formatDay(review.createdAt)}
                  </span>
                  {review.status === "hidden" && <Badge variant="draft">Hidden</Badge>}
                </span>
                {review.text ? <p className="text-sm break-words whitespace-pre-line">{review.text}</p> : <p className="text-sm text-mute">No written review.</p>}
              </div>
              <ReviewRowActions review={{ id: review.id, buyerName: review.buyerName, hidden: review.status === "hidden" }} />
            </li>
          ))}
        </ul>
      </ListCard>
    </div>
  );
}
