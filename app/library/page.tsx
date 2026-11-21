import { ArrowRight, BookOpen, CalendarCheck, ChevronRight, Download, Library, PlayCircle, ShoppingBag, Sparkles, Video } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { formatDay } from "@/components/dashboard/orders-ui";
import { PurchaseCover, StoreChip } from "@/components/library/purchase-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/guards";
import { getProfile } from "@/lib/auth/profiles";
import { formatCallTime } from "@/lib/coaching/ics";
import { listPurchases, type Purchase } from "@/lib/library/queries";
import { cn } from "@/lib/utils";

// Buyer library (PRD F13, DESIGN.md 10.6): a welcome, what to pick up next (a course in progress, an
// upcoming call), then every purchase made with this email, filterable by type.

const FILTERS = [
  { id: "all", label: "All" },
  { id: "courses", label: "Courses" },
  { id: "downloads", label: "Downloads" },
  { id: "calls", label: "Calls" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const KIND_OF: Record<Exclude<FilterId, "all">, Purchase["kind"]> = { courses: "course", downloads: "digital", calls: "coaching" };
const KIND_LABEL: Record<Purchase["kind"], string> = { course: "Course", digital: "Digital product", coaching: "Coaching call" };

export default function LibraryPage({ searchParams }: PageProps<"/library">) {
  return (
    <Suspense fallback={<LibrarySkeleton />}>
      <LibraryContent searchParams={searchParams} />
    </Suspense>
  );
}

const isOpen = (purchase: Purchase) => purchase.status === "paid" && purchase.available && !purchase.accessEnded;
const percentOf = (progress: Purchase["progress"]) => (progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0);

async function LibraryContent({ searchParams }: { searchParams: PageProps<"/library">["searchParams"] }) {
  const [user, query] = await Promise.all([requireUser("/library"), searchParams]);
  const [purchases, profile] = await Promise.all([user.email ? listPurchases(user.email) : Promise.resolve([]), getProfile(user.id).catch(() => null)]);
  const firstName = profile?.fullName?.trim().split(/\s+/)[0] ?? null;
  const filter: FilterId = FILTERS.some((item) => item.id === query.show) ? (query.show as FilterId) : "all";

  const courses = purchases.filter((purchase) => purchase.kind === "course" && isOpen(purchase));
  // The course to pick up: started and not finished, else the newest one not started.
  const inProgress = courses.filter((purchase) => purchase.progress && purchase.progress.done > 0 && purchase.progress.done < purchase.progress.total);
  const resume = inProgress.sort((a, b) => percentOf(b.progress) - percentOf(a.progress))[0] ?? courses.find((purchase) => (purchase.progress?.done ?? 0) === 0) ?? null;
  const upcoming = purchases
    .filter((purchase) => purchase.kind === "coaching" && purchase.status === "paid" && purchase.call && !purchase.call.ended && purchase.call.status === "confirmed")
    .sort((a, b) => (a.call?.start.getTime() ?? 0) - (b.call?.start.getTime() ?? 0))[0];

  const shown = filter === "all" ? purchases : purchases.filter((purchase) => purchase.kind === KIND_OF[filter]);
  const counts: Record<FilterId, number> = {
    all: purchases.length,
    courses: purchases.filter((p) => p.kind === "course").length,
    downloads: purchases.filter((p) => p.kind === "digital").length,
    calls: purchases.filter((p) => p.kind === "coaching").length,
  };

  return (
    <>
      <WelcomeCard firstName={firstName} purchases={purchases.length} learning={inProgress.length} calls={upcoming ? 1 : 0} />

      {purchases.length === 0 ? (
        <EmptyLibrary email={user.email} />
      ) : (
        <>
          {(resume || upcoming) && (
            <section aria-labelledby="next-title" className="flex flex-col gap-3">
              <h2 id="next-title" className="font-display text-h3">
                Pick up where you left off
              </h2>
              <div className={cn("grid gap-4", resume && upcoming && "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]")}>
                {resume && <ResumeCard purchase={resume} />}
                {upcoming && <UpcomingCall purchase={upcoming} />}
              </div>
            </section>
          )}

          <section aria-labelledby="purchases-title" className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-0.5">
                <h2 id="purchases-title" className="font-display text-h3">
                  Your purchases
                </h2>
                <p className="text-sm text-mute">Everything you bought, in one place.</p>
              </div>
              <nav aria-label="Filter purchases" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
                {FILTERS.filter((item) => item.id === "all" || counts[item.id] > 0).map((item) => {
                  const active = item.id === filter;
                  return (
                    <Link
                      key={item.id}
                      href={item.id === "all" ? "/library" : `/library?show=${item.id}`}
                      aria-current={active ? "page" : undefined}
                      scroll={false}
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors duration-(--dur-fast) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-glow",
                        active ? "border-ink bg-ink text-surface" : "border-line bg-surface text-mute hover:border-border-strong hover:text-ink",
                      )}
                    >
                      {item.label}
                      <span className={cn("tabular-nums", active ? "text-surface/70" : "text-mute")}>{counts[item.id]}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {shown.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-mute">Nothing here yet.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((purchase) => (
                  <li key={purchase.orderId}>
                    <PurchaseCard purchase={purchase} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

function WelcomeCard({ firstName, purchases, learning, calls }: { firstName: string | null; purchases: number; learning: number; calls: number }) {
  const stats = [
    { icon: ShoppingBag, label: purchases === 1 ? "Purchase" : "Purchases", value: purchases, tint: "bg-blue-soft text-blue" },
    { icon: BookOpen, label: "Learning", value: learning, tint: "bg-violet-soft text-violet" },
    { icon: CalendarCheck, label: calls === 1 ? "Call booked" : "Calls booked", value: calls, tint: "bg-mint-soft text-mint" },
  ];
  return (
    <section aria-labelledby="welcome-title" className="relative isolate overflow-hidden rounded-lg border border-line bg-blue-soft px-5 py-6 sm:px-8 sm:py-8">
      {/* Soft shapes behind the text: decoration only. */}
      <span aria-hidden="true" className="absolute -top-24 -right-20 -z-10 size-72 rounded-full bg-violet-soft" />
      <span aria-hidden="true" className="absolute -bottom-32 left-1/4 -z-10 size-72 rounded-full bg-surface/50" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-xl flex-col gap-2">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue">
            <Sparkles aria-hidden="true" className="size-4" />
            Your library
          </p>
          <h1 id="welcome-title" className="font-display text-h1 break-words text-ink">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
          <p className="text-body-l text-mute">Your courses, downloads and calls, ready whenever you are.</p>
        </div>
        <dl className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[420px]">
          {stats.map(({ icon: Icon, label, value, tint }) => (
            <div key={label} className="flex flex-col gap-2 rounded-md border border-line bg-surface/90 p-3 sm:p-4 xl:flex-row xl:items-center xl:gap-3">
              <span aria-hidden="true" className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", tint)}>
                <Icon className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <dd className="font-display text-h2 leading-none tabular-nums">{value}</dd>
                <dt className="text-xs leading-tight text-mute">{label}</dt>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** The course to continue: big cover, progress and one button straight into the player. */
function ResumeCard({ purchase }: { purchase: Purchase }) {
  const progress = purchase.progress;
  const percent = percentOf(progress);
  const started = (progress?.done ?? 0) > 0;
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-sm sm:flex-row">
      <Link href={`/library/${purchase.orderId}/learn`} tabIndex={-1} aria-hidden="true" className="sm:w-2/5">
        <PurchaseCover coverUrl={purchase.coverUrl} title={purchase.title} kind="course" className="aspect-video size-full sm:aspect-auto sm:min-h-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <Badge variant="live" className="self-start">
            <PlayCircle aria-hidden="true" className="size-3.5" />
            {started ? "In progress" : "Ready to start"}
          </Badge>
          <h3 className="font-display text-h3 break-words">{purchase.title}</h3>
          <StoreChip name={purchase.storeName} avatarUrl={purchase.storeAvatarUrl} />
        </div>
        {progress && progress.total > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-mute">
                {progress.done} of {progress.total} lessons
              </span>
              <span className="font-semibold tabular-nums">{percent}%</span>
            </div>
            <Progress value={percent} max={100} aria-label="Course progress" aria-valuetext={`${percent}% complete`} />
          </div>
        )}
        <Button asChild className="mt-auto self-start">
          <Link href={`/library/${purchase.orderId}/learn`}>
            {started ? "Continue learning" : "Start course"}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

/** The next confirmed call: a date tile, the time in the buyer's zone and the way in. */
function UpcomingCall({ purchase }: { purchase: Purchase }) {
  const call = purchase.call as NonNullable<Purchase["call"]>;
  const zone = call.buyerTimeZone ?? call.coachTimeZone ?? "UTC";
  const part = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat("en", { ...options, timeZone: zone }).format(call.start);
    } catch {
      return new Intl.DateTimeFormat("en", options).format(call.start);
    }
  };
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="flex w-16 shrink-0 flex-col items-center overflow-hidden rounded-md border border-line">
          <span className="w-full bg-mint py-0.5 text-center text-xs font-bold tracking-wide text-surface uppercase">{part({ month: "short" })}</span>
          <span className="py-1.5 font-display text-h2 tabular-nums">{part({ day: "numeric" })}</span>
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="live" className="self-start">
            <CalendarCheck aria-hidden="true" className="size-3.5" />
            Upcoming call
          </Badge>
          <h3 className="font-display text-h4 break-words">{purchase.title}</h3>
          <p className="text-sm text-mute">{formatCallTime(call.start, call.end, zone)}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        {call.meetingUrl ? (
          <Button asChild>
            <a href={call.meetingUrl} target="_blank" rel="noopener noreferrer">
              <Video aria-hidden="true" className="size-4" />
              Join link
            </a>
          </Button>
        ) : null}
        <Button asChild variant="secondary">
          <Link href={`/library/${purchase.orderId}`}>View booking</Link>
        </Button>
      </div>
    </article>
  );
}

/**
 * One purchase (D-070): cover, type, creator, state, a course's progress and the next action. An
 * open course goes straight to the player; everything else to its purchase page.
 */
function PurchaseCard({ purchase }: { purchase: Purchase }) {
  const course = purchase.kind === "course";
  const coaching = purchase.kind === "coaching";
  const open = isOpen(purchase);
  const progress = course ? purchase.progress : null;
  const percent = percentOf(progress);
  const done = progress !== null && progress.total > 0 && progress.done >= progress.total;
  const href = course && open ? `/library/${purchase.orderId}/learn` : `/library/${purchase.orderId}`;
  const action = !open ? "View details" : coaching ? "View booking" : !course ? "Open" : done ? "Review course" : progress && progress.done > 0 ? "Continue" : "Start course";
  const ActionIcon = !open ? ChevronRight : coaching ? CalendarCheck : course ? PlayCircle : Download;
  const state =
    purchase.status === "refunded" ? { label: "Refunded", variant: "draft" as const } : !purchase.available ? { label: "Unavailable", variant: "testMode" as const } : purchase.accessEnded ? { label: "Access ended", variant: "draft" as const } : done ? { label: "Completed", variant: "live" as const } : null;

  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface transition-[border-color,box-shadow,transform] duration-(--dur-fast) hover:-translate-y-0.5 hover:border-field-border hover:shadow-popover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-glow motion-reduce:hover:translate-y-0"
    >
      <span className="relative">
        <PurchaseCover coverUrl={purchase.coverUrl} title={purchase.title} kind={purchase.kind} className={cn("aspect-video w-full", !open && "opacity-70 grayscale")} />
        <span className="absolute top-3 left-3 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">{KIND_LABEL[purchase.kind]}</span>
        {state && (
          <Badge variant={state.variant} className="absolute top-3 right-3 shadow-sm">
            {state.label}
          </Badge>
        )}
      </span>
      <span className="flex flex-1 flex-col gap-3 p-4">
        <span className="flex flex-col gap-1.5">
          <span className="font-display text-h4 break-words">{purchase.title}</span>
          <StoreChip name={purchase.storeName} avatarUrl={purchase.storeAvatarUrl} />
        </span>
        {progress && progress.total > 0 ? (
          <span className="flex flex-col gap-1.5">
            <Progress value={percent} max={100} aria-label="Course progress" aria-valuetext={`${progress.done} of ${progress.total} lessons done`} />
            <span className="flex justify-between text-xs text-mute tabular-nums">
              <span>
                {progress.done} of {progress.total} lessons
              </span>
              <span>{percent}%</span>
            </span>
          </span>
        ) : (
          <span className="text-xs text-mute">{coaching && purchase.call ? `Call on ${callDay(purchase.call)}` : purchase.paidAt ? `Bought ${formatDay(purchase.paidAt)}` : null}</span>
        )}
        <span className={cn("mt-auto flex items-center justify-between border-t border-line pt-3 text-sm font-semibold", open ? "text-blue" : "text-mute")}>
          <span className="inline-flex items-center gap-1.5">
            <ActionIcon aria-hidden="true" className="size-4" />
            {action}
          </span>
          <ChevronRight aria-hidden="true" className="size-4 transition-transform duration-(--dur-fast) group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0" />
        </span>
      </span>
    </Link>
  );
}

function EmptyLibrary({ email }: { email: string | null }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-14 text-center">
      <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-blue-soft text-blue">
        <Library className="size-8" />
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <h2 className="font-display text-h3">No purchases yet</h2>
        <p className="text-sm text-mute">
          Purchases show up here when you sign in with the same email you used at checkout{email ? ` (${email})` : ""}. Bought with another email? Sign out and sign in
          with that one.
        </p>
      </div>
    </section>
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
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading your library</span>
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((key) => (
          <div key={key} className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
