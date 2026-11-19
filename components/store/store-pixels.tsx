"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { suppressCookieNotice } from "@/components/legal/cookie-notice";
import { Button } from "@/components/ui/button";
import type { StorePixels } from "@/lib/pixels/rules";

// The creator's Meta and Google pixels on their own store pages (D-097). Nothing loads until the
// visitor accepts; the choice is kept per store in local storage. Only IDs from the server (checked
// against strict patterns) go into these fixed snippets. A purchase fires once per order.

export type PixelEvent =
  | { kind: "view_content"; contentId: string; value: number; currency: string }
  | { kind: "begin_checkout"; contentId: string; value: number; currency: string }
  | { kind: "purchase"; contentId: string; value: number; currency: string; orderId: string };

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[]; push: unknown; loaded: boolean; version: string };
type PixelWindow = Window & { fbq?: Fbq; _fbq?: Fbq; dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; __psPixels?: Set<string> };

type Choice = "granted" | "denied" | null;
const keyOf = (storeId: string) => `ps_pixels_${storeId}`;
const listeners = new Set<() => void>();

function readChoice(storeId: string): Choice {
  try {
    const value = window.localStorage.getItem(keyOf(storeId));
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function writeChoice(storeId: string, choice: Exclude<Choice, null>) {
  try {
    window.localStorage.setItem(keyOf(storeId), choice);
  } catch {
    // Blocked storage: the choice holds for this page view only.
  }
  memory.set(storeId, choice);
  listeners.forEach((notify) => notify());
}

const memory = new Map<string, Exclude<Choice, null>>();

function loadScript(src: string) {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/** Meta's base code (developers.facebook.com/docs/meta-pixel/get-started), written out in TypeScript. */
function startMeta(win: PixelWindow, id: string) {
  if (!win.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.queue = [];
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    win.fbq = fbq;
    if (!win._fbq) win._fbq = fbq;
    loadScript("https://connect.facebook.net/en_US/fbevents.js");
  }
  win.fbq("init", id);
  win.fbq("track", "PageView");
}

/** The Google tag (gtag.js) with `config`, which Google keeps working for existing installs. */
function startGoogle(win: PixelWindow, id: string) {
  if (!win.gtag) {
    win.dataLayer = win.dataLayer ?? [];
    const dataLayer = win.dataLayer;
    win.gtag = function gtag() {
      // gtag.js reads the `arguments` object itself, so it is pushed as is.
      // eslint-disable-next-line prefer-rest-params
      dataLayer.push(arguments);
    };
    win.gtag("js", new Date());
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  }
  win.gtag("config", id);
}

function purchaseSeen(orderId: string): boolean {
  try {
    if (window.localStorage.getItem(`ps_px_order_${orderId}`)) return true;
    window.localStorage.setItem(`ps_px_order_${orderId}`, "1");
  } catch {
    // Without storage a reload may count again; the order id still lets the ad tools dedupe.
  }
  return false;
}

function track(win: PixelWindow, pixels: StorePixels, event: PixelEvent) {
  const items = [{ item_id: event.contentId }];
  if (event.kind === "purchase" && purchaseSeen(event.orderId)) return;
  if (pixels.metaPixelId && win.fbq) {
    const params = { content_ids: [event.contentId], content_type: "product", value: event.value, currency: event.currency.toUpperCase() };
    if (event.kind === "view_content") win.fbq("track", "ViewContent", params);
    if (event.kind === "begin_checkout") win.fbq("track", "InitiateCheckout", params);
    if (event.kind === "purchase") win.fbq("track", "Purchase", params, { eventID: event.orderId });
  }
  if (pixels.googleTagId && win.gtag) {
    const params = { currency: event.currency.toUpperCase(), value: event.value, items };
    if (event.kind === "view_content") win.gtag("event", "view_item", params);
    if (event.kind === "begin_checkout") win.gtag("event", "begin_checkout", params);
    if (event.kind === "purchase") win.gtag("event", "purchase", { ...params, transaction_id: event.orderId });
  }
}

export function StorePixels({ storeId, storeName, pixels, event }: { storeId: string; storeName: string; pixels: StorePixels; event?: PixelEvent }) {
  const choice = useSyncExternalStore(
    (notify) => (listeners.add(notify), () => listeners.delete(notify)),
    () => memory.get(storeId) ?? readChoice(storeId),
    () => "unknown" as const, // the server (and the first paint) renders nothing
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (choice === null) suppressCookieNotice();
  }, [choice]);

  useEffect(() => {
    if (choice !== "granted") return;
    const win = window as PixelWindow;
    // Start each pixel once per page load, even when several store parts mount.
    win.__psPixels = win.__psPixels ?? new Set();
    if (pixels.metaPixelId && !win.__psPixels.has(`meta:${pixels.metaPixelId}`)) {
      startMeta(win, pixels.metaPixelId);
      win.__psPixels.add(`meta:${pixels.metaPixelId}`);
    }
    if (pixels.googleTagId && !win.__psPixels.has(`google:${pixels.googleTagId}`)) {
      startGoogle(win, pixels.googleTagId);
      win.__psPixels.add(`google:${pixels.googleTagId}`);
    }
    if (event) track(win, pixels, event);
  }, [choice, pixels, event]);

  const decide = (next: "granted" | "denied") => {
    const before = memory.get(storeId) ?? readChoice(storeId);
    writeChoice(storeId, next);
    setSettingsOpen(false);
    if (before === "granted" && next === "denied") {
      // Meta's consent API, then a fresh page without any pixel scripts.
      (window as PixelWindow).fbq?.("consent", "revoke");
      window.location.reload();
    }
  };

  if (choice === "unknown") return null;

  const tools = [pixels.metaPixelId ? "Meta" : null, pixels.googleTagId ? "Google" : null].filter(Boolean).join(" and ");

  if (choice === null || settingsOpen) {
    return (
      <div role="region" aria-label="Cookie choice" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg rounded-lg border border-line bg-surface p-4 text-ink shadow-popover sm:inset-x-auto sm:right-4 sm:left-auto">
        <p className="text-sm">
          {storeName} would like to use {tools} cookies to measure its ads. They are only set if you allow them.{" "}
          <Link href="/cookies" className="font-semibold text-blue underline underline-offset-4">
            Cookie Policy
          </Link>
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => decide("denied")}>
            Decline
          </Button>
          <Button type="button" size="sm" onClick={() => decide("granted")}>
            Allow
          </Button>
        </div>
      </div>
    );
  }

  return (
    <p className="py-4 text-center text-xs">
      <button type="button" className="underline underline-offset-4 opacity-70 hover:opacity-100" onClick={() => setSettingsOpen(true)}>
        Cookie settings
      </button>
    </p>
  );
}
