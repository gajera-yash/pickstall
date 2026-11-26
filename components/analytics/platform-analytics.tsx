"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useAnalyticsChoice } from "@/components/analytics/consent";
import { publicEnv } from "@/lib/env";
import { isTrackedPath, measurementIdOf } from "@/lib/analytics/platform";

type GaWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; __psGa?: boolean };

/**
 * Google Analytics 4 on Pickstall's own pages (D-133): loaded only on the tracked marketing and
 * legal pages, only after the visitor accepts, with ads storage and ad personalisation denied.
 * Later page changes in the app are counted by GA's enhanced measurement (browser history events).
 */
export function PlatformAnalytics() {
  const pathname = usePathname();
  const choice = useAnalyticsChoice();
  const id = measurementIdOf(publicEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID);

  useEffect(() => {
    if (!id || choice !== "granted" || !isTrackedPath(pathname)) return;
    const win = window as GaWindow;
    if (win.__psGa) return;
    win.__psGa = true;
    win.dataLayer = win.dataLayer ?? [];
    const dataLayer = win.dataLayer;
    win.gtag = function gtag() {
      // gtag.js reads the `arguments` object itself, so it is pushed as is.
      // eslint-disable-next-line prefer-rest-params
      dataLayer.push(arguments);
    };
    win.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    win.gtag("js", new Date());
    win.gtag("config", id, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }, [id, choice, pathname]);

  useEffect(() => {
    // A visitor who withdraws consent: stop GA from storing anything more on this page.
    const win = window as GaWindow;
    if (choice === "denied" && win.gtag) win.gtag("consent", "update", { analytics_storage: "denied" });
  }, [choice]);

  return null;
}
