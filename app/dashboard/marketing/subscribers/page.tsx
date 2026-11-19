import { ArrowLeft, Download, Mail, Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { formatDay, Initial, ListCard } from "@/components/dashboard/orders-ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { WelcomeEmailForm } from "@/components/dashboard/list-email-composer";
import { SubscriberRowActions } from "@/components/dashboard/subscriber-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { findWelcomeEmail } from "@/lib/broadcasts/queries";
import { requireUnlockedCreator } from "@/lib/dashboard/setup-gate";
import { withQuery } from "@/lib/orders/params";
import { subscriberLimit } from "@/lib/plans/access";
import { countSubscribed, listSubscribers, type SubscriberListItem } from "@/lib/subscribers/queries";

// The creator's email list (D-094): everyone who signed up for a lead magnet or ticked "Email me
// updates" at checkout. Search, "Load more", CSV export, and per row Unsubscribe or Delete. Only
// the signed-in creator's store. The welcome email (D-095) is set here too.
const PATH = "/dashboard/marketing/subscribers";
const WELCOME_DRAFT = "Hi {{customer_name}},\n\nThanks for joining my list! I'll share new guides and offers here from time to time.";

export default function SubscribersPage({ searchParams }: PageProps<"/dashboard/marketing/subscribers">) {
  return (
    <>
      <Link href="/dashboard/marketing" className="inline-flex items-center gap-1 self-start text-sm font-semibold text-mute hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Marketing
      </Link>
      <PageHeader
        title="Subscribers"
        description="People who joined your email list from a free download or at checkout."
        action={
          <Button asChild variant="secondary">
            <a href={`${PATH}/export`} download>
              <Download aria-hidden="true" className="size-4" />
              Export CSV
            </a>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
        <SubscribersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function text(value: string | string[] | undefined, max: number): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim().slice(0, max);
  return trimmed ? trimmed : undefined;
}

function parseBefore(value: string | string[] | undefined): Date | undefined {
  const raw = text(value, 40);
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function SubscribersContent({ searchParams }: Pick<PageProps<"/dashboard/marketing/subscribers">, "searchParams">) {
  const [{ store }, raw] = await Promise.all([requireUnlockedCreator(PATH), searchParams]);
  const q = text(raw.q, 80);
  const before = parseBefore(raw.before);
  const [page, subscribed, welcome] = await Promise.all([listSubscribers(store.id, { q, before }), countSubscribed(store.id), findWelcomeEmail(store.id)]);
  const limit = subscriberLimit(store.access);

  return (
    <div className="flex flex-col gap-4">
      <ListCard>
        <div className="flex flex-col gap-2 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-h3 tabular-nums">
              {subscribed.toLocaleString("en")} <span className="text-base font-normal text-mute">of {limit.toLocaleString("en")} on your plan</span>
            </span>
            {subscribed >= limit && <Badge variant="danger">List is full</Badge>}
          </div>
          <Progress value={Math.min(100, Math.round((subscribed / limit) * 100))} max={100} aria-label="Subscribers used on your plan" />
          <p className="text-sm text-mute">
            Only subscribed people count.{" "}
            <Link href="/dashboard/marketing/broadcasts" className="font-semibold text-blue underline underline-offset-4">
              Send a broadcast
            </Link>
          </p>
        </div>
      </ListCard>

      <WelcomeEmailForm storeName={store.name} initial={welcome ?? { enabled: false, subject: `Welcome to ${store.name}`, body: WELCOME_DRAFT }} />

      <form action={PATH} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup className="h-10 sm:w-72">
          <InputGroupInput type="search" name="q" aria-label="Search subscribers" defaultValue={q ?? ""} maxLength={80} placeholder="Search name or email..." className="text-sm" />
          <InputGroupAddon>
            <Search aria-hidden="true" className="size-4" />
          </InputGroupAddon>
        </InputGroup>
        <Button type="submit" className="sr-only">
          Search
        </Button>
      </form>

      {page.items.length === 0 ? (
        <EmptyState icon={q ? Search : Mail} title={q ? "No matching subscribers" : "No subscribers yet"}>
          {q ? (
            "Try a different name or email."
          ) : (
            <>
              Add a <Link href="/dashboard/products/new" className="font-semibold text-blue underline underline-offset-4">Collect emails</Link> product to give away a free guide, or wait for buyers who tick &ldquo;Email me updates&rdquo; at checkout.
            </>
          )}
        </EmptyState>
      ) : (
        <ListCard>
          <SubscribersTable items={page.items} />
        </ListCard>
      )}

      {page.nextBefore && (
        <Button asChild variant="secondary" className="self-center">
          <Link href={withQuery(PATH, { q, before: page.nextBefore })}>Load more</Link>
        </Button>
      )}
    </div>
  );
}

function StatusBadge({ item }: { item: SubscriberListItem }) {
  return item.status === "subscribed" ? <Badge variant="live">Subscribed</Badge> : <Badge variant="draft">Unsubscribed</Badge>;
}

function SubscribersTable({ items }: { items: SubscriberListItem[] }) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Subscriber</TableHead>
              <TableHead>Joined from</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-72">
                  <span className="flex items-center gap-3">
                    <Initial name={item.name ?? item.email} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold">{item.name ?? item.email}</span>
                      {item.name && <span className="truncate text-xs text-mute">{item.email}</span>}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="max-w-60">
                  <span className="block truncate">{item.sourceTitle}</span>
                  <span className="block text-xs text-mute">{item.sourceKind === "lead_magnet" ? "Free download" : "At checkout"}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge item={item} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-mute">{formatDay(item.joinedAt)}</TableCell>
                <TableCell className="w-12 text-right">
                  <SubscriberRowActions subscriber={{ id: item.id, email: item.email, subscribed: item.status === "subscribed" }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <Initial name={item.name ?? item.email} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-semibold">{item.name ?? item.email}</span>
              {item.name && <span className="truncate text-sm text-mute">{item.email}</span>}
              <span className="flex flex-wrap items-center gap-2 text-xs text-mute">
                <StatusBadge item={item} />
                {item.sourceTitle} · {formatDay(item.joinedAt)}
              </span>
            </span>
            <SubscriberRowActions subscriber={{ id: item.id, email: item.email, subscribed: item.status === "subscribed" }} />
          </li>
        ))}
      </ul>
    </>
  );
}
