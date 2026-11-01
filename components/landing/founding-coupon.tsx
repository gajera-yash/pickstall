"use client";

import { ArrowRight, Scissors } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * The founding offer as a tear-off coupon. "Tear here" is a real button; the stub falls away and
 * the signup button is revealed. A plain signup link is always there for anyone who skips it.
 */
export function FoundingCoupon() {
  const [torn, setTorn] = useState(false);

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="flex flex-col overflow-hidden rounded-lg border-2 border-border-strong bg-yellow text-on-yellow shadow-hard-md sm:flex-row">
        <div className="flex flex-1 flex-col gap-2 p-6">
          <p className="text-xs font-semibold">Founding creators</p>
          <p className="font-display text-display">6 months free</p>
          <p className="text-sm font-medium">10 spots. Personal setup with the founder.</p>
        </div>
        <div className="relative flex flex-col items-center justify-center gap-2 border-t-2 border-dashed border-border-strong p-5 sm:w-44 sm:border-t-0 sm:border-l-2">
          <Scissors aria-hidden="true" className="absolute -top-3.5 left-6 size-6 -rotate-90 bg-yellow sm:top-6 sm:-left-3.5 sm:rotate-0" />
          {torn ? (
            <p className="animate-pop text-center text-sm font-semibold">Torn off. It&apos;s yours.</p>
          ) : (
            <Button type="button" variant="secondary" onClick={() => setTorn(true)} className="border-2 border-border-strong">
              Tear here
            </Button>
          )}
        </div>
      </div>
      {torn && (
        <div aria-hidden="true" className="pointer-events-none absolute right-0 bottom-0 hidden h-full w-44 animate-tear rounded-r-lg border-2 border-border-strong bg-yellow sm:block" />
      )}
      <div aria-live="polite" className="mt-5 flex flex-col items-center gap-2">
        {torn ? (
          <Button asChild size="lg" className="animate-rise">
            <Link href="/signup">
              Claim a founding spot
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Link href="/signup" className="text-sm font-semibold text-blue underline underline-offset-4 hover:text-blue-hover">
            Skip the scissors and sign up
          </Link>
        )}
      </div>
    </div>
  );
}
