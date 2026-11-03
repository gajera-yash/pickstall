import type { ReactNode } from "react";
import { ArrowRight, CreditCard, Library, Lock, Mail, MessageSquareText } from "lucide-react";

import { CARD_FEES_NOTE } from "@/components/landing/content";
import { ReceiptEdge } from "@/components/landing/illustrations";
import { Reveal } from "@/components/landing/motion";
import { Badge } from "@/components/ui/badge";
import { CHECKOUT_QUESTIONS_MAX } from "@/lib/config";

// Checkout (D-039): the buyer's path from checkout to receipt to their library, as three example
// panels. Static markup; only the receipt "prints" once when it scrolls into view.

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col gap-4">
      <p className="flex items-center gap-3 text-sm font-semibold">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-xs tabular-nums">{n}</span>
        {title}
      </p>
      {children}
    </li>
  );
}

export function CheckoutShowcase() {
  return (
    <div className="flex flex-col gap-6">
      <ol className="grid gap-8 lg:grid-cols-3 lg:gap-6">
        <Step n={1} title="Your checkout, your questions">
          <div aria-hidden="true" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-popover">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Freelancer budget workbook</p>
                <p className="text-xs text-mute">Maya&apos;s Money Studio</p>
              </div>
              <p className="font-display text-money-m tabular-nums">$19.00</p>
            </div>
            <span className="rounded-md border border-input px-3 py-2 text-sm text-mute">Jordan Lee</span>
            <span className="rounded-md border border-input px-3 py-2 text-sm text-mute">jordan@example.com</span>
            <span className="flex items-center gap-2 rounded-md border-2 border-blue px-3 py-2 text-sm">
              <MessageSquareText className="size-4 shrink-0 text-blue" />
              What do you freelance in?
            </span>
            <span className="flex items-center justify-center gap-2 rounded-md bg-blue py-2.5 text-sm font-semibold text-on-blue">
              <Lock className="size-4" />
              Pay $19.00
            </span>
            <p className="flex items-center justify-center gap-1.5 text-xs text-mute">
              <CreditCard className="size-3.5" />
              Payments processed by Stripe
            </p>
          </div>
          <p className="text-sm text-mute">Name and email always, plus up to {CHECKOUT_QUESTIONS_MAX} questions of your own. Answers land in your Customers tab.</p>
        </Step>

        <Step n={2} title="Paid straight to you">
          <div className="overflow-hidden">
            <Reveal variant="print" delay={0.15}>
              <div className="font-mono text-sm">
                <div className="flex flex-col gap-2 rounded-t-sm border-2 border-b-0 border-border-strong bg-surface px-5 pt-5 pb-3">
                  <p className="flex justify-between font-semibold">
                    <span>Order #{1042}</span>
                    <Badge variant="example">Example</Badge>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span>Budget workbook</span>
                    <span className="tabular-nums">$19.00</span>
                  </p>
                  <p className="flex justify-between gap-4 text-mint">
                    <span>Platform fee</span>
                    <span className="tabular-nums">$0.00</span>
                  </p>
                  <p className="flex justify-between gap-4 text-mute">
                    <span>Card processing</span>
                    <span>set by Stripe</span>
                  </p>
                  <p className="flex justify-between gap-4 border-t border-dashed border-input pt-2 font-semibold">
                    <span>Paid to your account</span>
                    <span className="tabular-nums">$19.00*</span>
                  </p>
                </div>
                <ReceiptEdge />
              </div>
            </Reveal>
          </div>
          <p className="text-sm text-mute">The buyer pays into your own Stripe account. We never hold your money. *Before card processing. {CARD_FEES_NOTE}</p>
        </Step>

        <Step n={3} title="Delivered after a verified payment">
          <div aria-hidden="true" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <Mail className="size-4 text-blue" />
                Your workbook is here, Jordan
              </p>
              <p className="text-mute">Open it any time from your library.</p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 text-sm">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-soft">
                <Library className="size-5 text-blue" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">Freelancer budget workbook</span>
                <span className="block text-xs text-mute">In Jordan&apos;s library</span>
              </span>
              <ArrowRight className="size-4 text-blue" />
            </div>
          </div>
          <p className="text-sm text-mute">Access is granted only once the payment is confirmed, never from a success page alone.</p>
        </Step>
      </ol>
    </div>
  );
}
