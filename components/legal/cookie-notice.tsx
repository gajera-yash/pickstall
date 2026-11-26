"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { setAnalyticsChoice, useAnalyticsChoice } from "@/components/analytics/consent";
import { Button } from "@/components/ui/button";
import { measurementIdOf } from "@/lib/analytics/platform";
import { publicEnv } from "@/lib/env";

// Cookie notice (D-074). The cookies we need are strictly necessary (see /cookies). With Google
// Analytics on our own pages (D-133) the notice is a real choice: "Accept" allows analytics,
// "Decline" keeps only the necessary cookies; both are equal buttons and the choice is kept in
// local storage (not a cookie). Without a measurement id it stays the plain notice. Creators'
// pixels (D-097) have their own accept / decline banner on their store pages.

const KEY = "ps_cookie_notice_closed";
const listeners = new Set<() => void>();

function closed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false; // storage blocked: show the notice, closing still hides it for this page view
  }
}

let closedThisVisit = false;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function close() {
  closedThisVisit = true;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Private mode or blocked storage: it stays hidden until the next visit.
  }
  listeners.forEach((notify) => notify());
}

/**
 * Hides the notice for this page view without remembering it (D-097): a store page with pixels shows
 * its own consent banner, which covers cookies, so two banners never stack.
 */
export function suppressCookieNotice() {
  closedThisVisit = true;
  listeners.forEach((notify) => notify());
}

export function CookieNotice() {
  // Hidden on the server and until the browser says otherwise, so nothing flashes or mismatches.
  const show = useSyncExternalStore(subscribe, () => !closedThisVisit && !closed(), () => false);
  const choice = useAnalyticsChoice();
  const analytics = measurementIdOf(publicEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID) !== null;

  if (analytics) {
    // A choice already made, or a store page with its own banner: nothing to ask.
    if (choice !== null || closedThisVisit) return null;
    const decide = (value: "granted" | "denied") => {
      setAnalyticsChoice(value);
      close();
    };
    return (
      <div role="region" aria-label="Cookie choice" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg rounded-lg border border-line bg-surface p-4 shadow-popover sm:inset-x-auto sm:right-4 sm:left-auto">
        <p className="text-sm">
          We use cookies to sign you in and keep the site safe. With your OK, we also use Google Analytics on our own pages to see how visitors find
          and use Pickstall. Never on your dashboard, library or creators&apos; stores.{" "}
          <Link href="/cookies" className="font-semibold text-blue underline underline-offset-4">
            Cookie Policy
          </Link>
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => decide("denied")}>
            Decline
          </Button>
          <Button type="button" size="sm" onClick={() => decide("granted")}>
            Accept
          </Button>
        </div>
      </div>
    );
  }

  if (!show) return null;
  return (
    <div role="region" aria-label="Cookie notice" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg rounded-lg border border-line bg-surface p-4 shadow-popover sm:inset-x-auto sm:right-4 sm:left-auto">
      <p className="text-sm">
        We only use cookies that are needed to sign you in and keep the site safe. No tracking or ads.{" "}
        <Link href="/cookies" className="font-semibold text-blue underline underline-offset-4">
          Cookie Policy
        </Link>
      </p>
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={close}>
          Got it
        </Button>
      </div>
    </div>
  );
}
