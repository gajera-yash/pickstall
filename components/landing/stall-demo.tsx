"use client";

import { Check, Plus, ReceiptText, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Awning, ReceiptEdge } from "@/components/landing/illustrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_STALL_NAME, DEMO_PRODUCTS, STALL_NAME_MAX, cleanStallName, initialsOf, nextSale, type DemoProduct } from "@/lib/landing/demo";
import { formatMoney } from "@/lib/products/money";
import { cn } from "@/lib/utils";

type Sale = { key: number; product: DemoProduct };

/**
 * "Build your stall": name a stall, stock the shelf, make a pretend sale and watch the receipt
 * print with a $0.00 platform fee. Client-side only, nothing is sent anywhere, labelled "Demo".
 */
export function StallDemo() {
  const nameId = useId();
  const [name, setName] = useState(DEFAULT_STALL_NAME);
  const [stockedIds, setStockedIds] = useState<string[]>(["guide", "templates"]);
  const [sales, setSales] = useState<Sale[]>([]);

  const stocked = DEMO_PRODUCTS.filter((product) => stockedIds.includes(product.id));
  const displayName = name.trim() || "Your stall";
  const keptCents = sales.reduce((sum, sale) => sum + sale.product.priceCents, 0);
  const lastSale = sales.at(-1) ?? null;

  function toggle(id: string) {
    setStockedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function makeSale() {
    const product = nextSale(stocked, sales.length);
    if (product) setSales((current) => [...current, { key: current.length + 1, product }]);
  }

  return (
    <div className="relative">
      {/* The stall: awning, hanging sign, then the counter with the phone and the controls. */}
      <div className="relative z-10 px-2">
        <Awning id="hero-awning" className="h-14 sm:h-16" />
        <div aria-hidden="true" className="absolute top-full right-8 flex origin-top animate-sign-swing flex-col items-center sm:right-12">
          <div className="flex gap-10">
            <span className="h-5 w-0.5 bg-border-strong" />
            <span className="h-5 w-0.5 bg-border-strong" />
          </div>
          <div className="-mt-0.5 rounded-lg border-2 border-border-strong bg-blue px-4 pt-1 pb-2 text-center text-on-blue shadow-hard-sm">
            <span className="block font-display text-[2.75rem] leading-none font-extrabold tracking-tight">0%</span>
            <span className="block text-xs font-semibold">transaction fees</span>
          </div>
        </div>
      </div>

      <div className="-mt-1 rounded-b-lg border-2 border-t-0 border-border-strong bg-bg-subtle px-4 pt-6 pb-5 shadow-hard-md sm:px-6">
        {/* Room on the right for the hanging sign, so it never covers a control. */}
        <div className="mb-14 flex items-center gap-2 pr-36">
          <Badge variant="example">Demo</Badge>
          <span className="hidden text-xs text-mute sm:inline">Nothing here is saved or sent.</span>
        </div>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,12.5rem)_minmax(0,1fr)] sm:items-start">
          <PhonePreview name={displayName} stocked={stocked} lastSale={lastSale} />

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={nameId}>1. Name your stall</Label>
              <Input
                id={nameId}
                value={name}
                maxLength={STALL_NAME_MAX}
                autoComplete="off"
                onChange={(event) => setName(cleanStallName(event.target.value))}
              />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-xs font-semibold">2. Stock your shelf</legend>
              <div className="flex flex-wrap gap-2">
                {DEMO_PRODUCTS.map((product) => {
                  const on = stockedIds.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(product.id)}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-(--dur-fast)",
                        on ? "border-blue bg-blue-soft text-ink" : "border-input bg-surface text-ink hover:bg-bg-subtle",
                      )}
                    >
                      {on ? <Check aria-hidden="true" className="size-4 text-blue" /> : <Plus aria-hidden="true" className="size-4 text-mute" />}
                      {product.title} {formatMoney(product.priceCents, "usd")}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold">3. Make a sale</span>
              <Button type="button" onClick={makeSale} disabled={stocked.length === 0} className="w-full sm:w-auto sm:self-start">
                <ShoppingBag aria-hidden="true" />
                Make a sale
              </Button>
              {stocked.length === 0 && <p className="text-sm text-mute">Add something to your shelf first.</p>}
            </div>

            <div aria-live="polite" className="flex flex-col gap-3">
              {lastSale ? (
                <>
                  <Receipt key={lastSale.key} sale={lastSale} />
                  <div className="flex items-end justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-mute">You kept</p>
                      <p className="text-xs text-mute">before card processing fees</p>
                    </div>
                    <p className="font-display text-money-l text-mint tabular-nums">{formatMoney(keptCents, "usd")}</p>
                  </div>
                  <Link href="/signup" className="text-sm font-semibold text-blue underline underline-offset-4 hover:text-blue-hover">
                    Like it? Claim your real stall link
                  </Link>
                </>
              ) : (
                <p className="flex items-center gap-2 rounded-md border border-dashed border-input px-4 py-3 text-sm text-mute">
                  <ReceiptText aria-hidden="true" className="size-4 shrink-0" />
                  Your receipt prints here.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhonePreview({ name, stocked, lastSale }: { name: string; stocked: DemoProduct[]; lastSale: Sale | null }) {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[12.5rem] rounded-[1.75rem] border-2 border-border-strong bg-surface p-2 shadow-hard-sm">
      <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-line" />
      <div className="flex min-h-[19rem] flex-col gap-2 rounded-[1.25rem] bg-bg-subtle px-3 pt-4 pb-3">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-blue-soft font-display text-sm font-extrabold text-blue">{initialsOf(name)}</span>
          <p className="max-w-full font-display text-sm leading-tight font-extrabold break-words">{name}</p>
        </div>
        <div className="mt-1 flex flex-col gap-1.5">
          {stocked.length === 0 ? (
            <p className="rounded-md border border-dashed border-input px-2 py-4 text-center text-xs text-mute">Empty shelf</p>
          ) : (
            stocked.map((product) => (
              <div key={product.id} className="flex animate-pop items-center justify-between gap-2 rounded-md border border-line bg-surface px-2.5 py-2">
                <span className="min-w-0 truncate text-xs font-semibold">{product.title}</span>
                <span className="shrink-0 rounded-full bg-blue px-2 py-0.5 text-[0.6875rem] font-semibold text-on-blue tabular-nums">
                  {formatMoney(product.priceCents, "usd")}
                </span>
              </div>
            ))
          )}
        </div>
        <p className="mt-auto pt-2 text-center text-[0.6875rem] text-mute">Powered by Pickstall</p>
      </div>
      {lastSale && (
        <div key={lastSale.key} className="absolute inset-x-3 top-3 animate-pop rounded-md border-2 border-border-strong bg-yellow px-2.5 py-1.5 text-xs font-semibold text-on-yellow">
          New sale: {lastSale.product.title}, {formatMoney(lastSale.product.priceCents, "usd")}
        </div>
      )}
    </div>
  );
}

function Receipt({ sale }: { sale: Sale }) {
  const price = formatMoney(sale.product.priceCents, "usd");
  return (
    <div className="overflow-hidden">
      <div className="animate-print font-mono text-xs">
        <div className="flex flex-col gap-1.5 border-x border-t border-line bg-surface px-4 pt-3 pb-2">
          <p className="flex justify-between font-semibold">
            <span>Order #{String(1000 + sale.key)}</span>
            <span>Paid</span>
          </p>
          <p className="flex justify-between gap-3">
            <span className="truncate">{sale.product.title}</span>
            <span className="tabular-nums">{price}</span>
          </p>
          <p className="flex justify-between gap-3 text-mint">
            <span>Platform fee</span>
            <span className="tabular-nums">$0.00</span>
          </p>
          <p className="flex justify-between gap-3 border-t border-dashed border-input pt-1.5 font-semibold">
            <span>Paid to your account</span>
            <span className="tabular-nums">{price}</span>
          </p>
        </div>
        <ReceiptEdge />
      </div>
    </div>
  );
}
