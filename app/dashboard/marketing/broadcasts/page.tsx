import { ArrowLeft, Megaphone } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { BroadcastComposer } from "@/components/dashboard/list-email-composer";
import { formatDay, ListCard } from "@/components/dashboard/orders-ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { countBroadcastsStartedSince, listBroadcasts, type BroadcastListItem } from "@/lib/broadcasts/queries";
import { broadcastProblem } from "@/lib/broadcasts/rules";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { subscriberLimit } from "@/lib/plans/access";
import { countSubscribed } from "@/lib/subscribers/queries";

// Broadcasts (D-095): write an email, send yourself a test, then send it to everyone subscribed.
// Below, the store's past broadcasts with how far each got. Only the signed-in creator's store.
const PATH = "/dashboard/marketing/broadcasts";

export default function BroadcastsPage() {
  return (
    <>
      <Link href="/dashboard/marketing" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Marketing
      </Link>
      <PageHeader title="Broadcasts" description="Email everyone on your list: news, a new product, an offer." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <BroadcastsContent />
      </Suspense>
    </>
  );
}

async function BroadcastsContent() {
  const { store } = await requireUnlockedCreator(PATH);
  const now = new Date();
  const [subscribed, startedToday, broadcasts] = await Promise.all([countSubscribed(store.id), countBroadcastsStartedSince(store.id, now), listBroadcasts(store.id)]);
  const blocked = broadcastProblem({ subscribed, startedToday, limit: subscriberLimit(store.access), blocked: store.broadcastsBlocked || store.access.state === "suspended" });

  return (
    <div className="flex flex-col gap-6">
      <BroadcastComposer storeName={store.name} subscribed={subscribed} blocked={blocked} />
      <section aria-labelledby="past-broadcasts" className="flex flex-col gap-3">
        <h2 id="past-broadcasts" className="font-display text-h3">
          Sent
        </h2>
        {broadcasts.length === 0 ? (
          <EmptyState icon={Megaphone} title="No broadcasts yet">
            Your broadcasts show here with how many people they reached.
          </EmptyState>
        ) : (
          <ListCard>
            <ul className="divide-y divide-line">
              {broadcasts.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{item.subject}</span>
                    <span className="text-sm text-mute">{formatDay(item.createdAt)}</span>
                  </span>
                  <span className="flex items-center gap-3 text-sm text-mute">
                    <span className="tabular-nums">
                      {item.sentCount.toLocaleString("en")} of {item.recipientCount.toLocaleString("en")} sent
                    </span>
                    <StatusBadge status={item.status} />
                  </span>
                </li>
              ))}
            </ul>
          </ListCard>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: BroadcastListItem["status"] }) {
  if (status === "sent") return <Badge variant="live">Sent</Badge>;
  if (status === "sending") return <Badge variant="testMode">Sending</Badge>;
  if (status === "failed") return <Badge variant="danger">Failed</Badge>;
  return <Badge variant="draft">Draft</Badge>;
}
