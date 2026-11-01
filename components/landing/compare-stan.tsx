import { ArrowRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";

import { COMPARE_ROWS, PICKSTALL_EXTRAS, STAN, type CompareRow } from "@/components/landing/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_NAME, PLANNED_PRICE_CENTS } from "@/lib/config";
import { formatWholeDollars, priceShare, yearlySavingsCents } from "@/lib/landing/demo";

// "Pickstall vs Stan Store" (D-040): planned prices side by side, then a feature table that says
// plainly what is live on Pickstall today and what is coming. Stan's facts come from STAN only.

const PLAN_LABEL: Record<CompareRow["plan"], string> = { starter: "Starter", pro: "Pro" };
const money = (cents: number) => formatWholeDollars(cents);

function PricePair({ title, theirs, theirsLabel, ours, oursLabel }: { title: string; theirs: number; theirsLabel: string; ours: number; oursLabel: string }) {
  const savings = yearlySavingsCents(theirs, ours);
  return (
    <div className="flex flex-col gap-4 rounded-lg border-2 border-border-strong bg-surface p-5 shadow-hard-sm sm:p-6">
      <p className="text-sm font-semibold text-mute">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-md bg-bg-subtle p-3">
          <span className="text-xs font-semibold text-mute">
            {STAN.name} {theirsLabel}
          </span>
          <span className="font-display text-money-l text-mute tabular-nums line-through decoration-2">{money(theirs)}</span>
          <span className="text-xs text-mute">per month</span>
        </div>
        <div className="flex flex-col gap-1 rounded-md border-2 border-blue bg-blue-soft p-3">
          <span className="text-xs font-semibold text-ink">
            {APP_NAME} {oursLabel}
          </span>
          <span className="font-display text-money-l text-blue tabular-nums">{money(ours)}</span>
          <span className="text-xs text-ink">per month, planned</span>
        </div>
      </div>
      <p className="flex items-center justify-between gap-3 rounded-md bg-yellow px-3 py-2 text-sm font-semibold text-on-yellow">
        <span>Save {money(savings)} a year</span>
        <span className="tabular-nums">{priceShare(ours, theirs)}% of the price</span>
      </p>
    </div>
  );
}

function StatusCell({ row }: { row: CompareRow }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {row.status === "live" ? (
        <Badge variant="live">
          <Check aria-hidden="true" className="size-3.5" />
          Live
        </Badge>
      ) : (
        <Badge variant="soon">Coming soon</Badge>
      )}
      <span className="text-sm text-mute">
        {PLAN_LABEL[row.plan]} {money(PLANNED_PRICE_CENTS[row.plan])}
      </span>
    </span>
  );
}

export function CompareStan() {
  const proSavings = money(yearlySavingsCents(STAN.creatorProCents, PLANNED_PRICE_CENTS.pro));
  return (
    <section id="compare" aria-labelledby="compare-title" className="scroll-mt-20 bg-bg-subtle py-20 sm:py-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 sm:px-6">
        <div className="flex max-w-3xl flex-col gap-3">
          <p className="text-sm font-semibold text-blue">
            {APP_NAME} vs {STAN.name}
          </p>
          <h2 id="compare-title" className="text-display-l text-balance">
            {STAN.name}&apos;s Pro toolkit, planned at {money(PLANNED_PRICE_CENTS.pro)} a month instead of {money(STAN.creatorProCents)}.
          </h2>
          <p className="text-body-l text-mute text-pretty">
            The same kind of creator store for less: up to {proSavings} a year back in your pocket. Founding creators pay nothing for the first 6 months. Below
            is exactly what is live today and what is on the way.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <PricePair title="Getting started" theirs={STAN.creatorCents} theirsLabel="Creator" ours={PLANNED_PRICE_CENTS.starter} oursLabel="Starter" />
          <PricePair title="Everything" theirs={STAN.creatorProCents} theirsLabel="Creator Pro" ours={PLANNED_PRICE_CENTS.pro} oursLabel="Pro" />
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Feature comparison between {STAN.name} and {APP_NAME}
            </caption>
            <thead className="hidden bg-bg-subtle sm:table-header-group">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Feature
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  {STAN.name}
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  {APP_NAME}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.feature} className="flex flex-col gap-2 border-t border-line px-4 py-4 first:border-t-0 sm:table-row sm:px-0 sm:py-0">
                  <th scope="row" className="font-semibold sm:px-5 sm:py-3.5">
                    {row.feature}
                  </th>
                  <td className="text-mute sm:px-5 sm:py-3.5">
                    <span className="font-semibold sm:hidden">{STAN.name}: </span>
                    {row.stan} {money(row.stan === "Creator" ? STAN.creatorCents : STAN.creatorProCents)}
                  </td>
                  <td className="flex flex-wrap items-center gap-2 sm:table-cell sm:px-5 sm:py-3.5">
                    <span className="text-sm font-semibold sm:hidden">{APP_NAME}:</span>
                    <StatusCell row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-blue bg-surface p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles aria-hidden="true" className="size-5 text-blue" />
              Live on {APP_NAME} today
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {PICKSTALL_EXTRAS.map((extra) => (
                <li key={extra} className="flex items-center gap-2 text-sm">
                  <Check aria-hidden="true" className="size-4 shrink-0 text-mint" />
                  {extra}
                </li>
              ))}
            </ul>
          </div>
          <Button asChild size="lg" className="px-7">
            <Link href="/signup">
              Switch to {APP_NAME}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <p className="text-xs text-mute">
          {STAN.name} plans and prices from {STAN.name}&apos;s help center ({STAN.source}), checked {STAN.checkedOn}; they may change, so check their
          site. {STAN.name} is a trademark of its owner; {APP_NAME} is not affiliated with it. {APP_NAME} prices are planned and confirmed before anyone is
          asked to pay. Card processing fees apply on both.
        </p>
      </div>
    </section>
  );
}
