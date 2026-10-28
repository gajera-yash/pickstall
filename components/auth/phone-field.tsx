"use client";

import { ChevronDown, Phone } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { FieldError, FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { DEFAULT_DIAL_REGION, DIAL_CODES, PHONE_HINT, composePhone, regionFromLocale, type DialRegion } from "@/lib/phone";
import { cn } from "@/lib/utils";

const noSubscribe = () => () => {};

/**
 * Optional phone with a country-code picker (reference docs/ui-reference/username.webp). The
 * picker is a native <select> laid over the "+91" label, so it keeps native keyboard and mobile
 * behaviour. The form gets one value, `phone`, in international format; the server validates it.
 */
export function PhoneField({ error }: { error?: string | null }) {
  // The browser's country is the default (the server renders the fallback, so hydration matches).
  const localeRegion = useSyncExternalStore(
    noSubscribe,
    () => regionFromLocale(navigator.language),
    () => DEFAULT_DIAL_REGION,
  );
  const [picked, setPicked] = useState<DialRegion | null>(null);
  const region = picked ?? localeRegion;
  const [national, setNational] = useState("");

  const dial = DIAL_CODES.find((entry) => entry.region === region)?.dial ?? "1";
  const describedBy = error ? "phone-error" : "phone-hint";

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="phone">
        Phone <span className="font-normal text-mute">(optional)</span>
      </Label>
      <input type="hidden" name="phone" value={composePhone(region, national)} />
      <div
        className={cn(
          "flex h-12 w-full min-w-0 items-stretch overflow-hidden rounded-sm border bg-surface",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          error ? "border-danger" : "border-input",
        )}
      >
        <div className="relative flex shrink-0 items-center gap-2 border-r border-line pr-3 pl-4">
          <Phone aria-hidden="true" className="size-5 text-mute" />
          <span aria-hidden="true" className="text-base font-medium text-ink tabular-nums">
            +{dial}
          </span>
          <ChevronDown aria-hidden="true" className="size-4 text-mute" />
          <select
            aria-label="Country code"
            value={region}
            onChange={(event) => setPicked(event.target.value as DialRegion)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {DIAL_CODES.map((entry) => (
              <option key={entry.region} value={entry.region}>
                {entry.name} +{entry.dial}
              </option>
            ))}
          </select>
        </div>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="98765 43210"
          value={national}
          onChange={(event) => setNational(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="min-w-0 flex-1 bg-transparent px-3 text-base text-ink outline-none placeholder:text-mute"
        />
      </div>
      {error ? <FieldError id="phone-error">{error}</FieldError> : <FieldHint id="phone-hint">{PHONE_HINT}</FieldHint>}
    </div>
  );
}
