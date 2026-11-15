"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

// Cookie notice (D-074). Every cookie we set is strictly necessary (see /cookies), so the law asks for
// information, not consent. Closing it is remembered in local storage (not a cookie). If optional
// cookies (analytics, ads) are ever added, this must become a real accept / decline choice first.

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

export function CookieNotice() {
  // Hidden on the server and until the browser says otherwise, so nothing flashes or mismatches.
  const show = useSyncExternalStore(subscribe, () => !closedThisVisit && !closed(), () => false);
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
