"use client";

import { setAnalyticsChoice, useAnalyticsChoice } from "@/components/analytics/consent";
import { Button } from "@/components/ui/button";

/** On the Cookie Policy (D-133): shows the visitor's analytics choice and lets them change it. */
export function CookieChoiceButton() {
  const choice = useAnalyticsChoice();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm">
        Google Analytics on this browser: <strong>{choice === "granted" ? "allowed" : choice === "denied" ? "declined" : "not chosen yet"}</strong>
      </span>
      {choice !== "granted" && (
        <Button type="button" size="sm" variant="secondary" onClick={() => setAnalyticsChoice("granted")}>
          Allow
        </Button>
      )}
      {choice !== "denied" && (
        <Button type="button" size="sm" variant="secondary" onClick={() => setAnalyticsChoice("denied")}>
          Decline
        </Button>
      )}
    </div>
  );
}
