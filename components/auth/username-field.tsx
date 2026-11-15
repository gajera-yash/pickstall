"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ROOT_DOMAIN } from "@/lib/config";
import { SLUG_MIN_LENGTH, normalizeSlugInput } from "@/lib/slug";
import { checkUsername, type UsernameCheck } from "@/lib/stores/username-check";
import { cn } from "@/lib/utils";

const CHECK_DELAY_MS = 400;

// The link prefix shows the site's own host once in the browser (localhost keeps ROOT_DOMAIN). Read
// without an effect, so the server render and hydration agree and nothing re-renders in a loop.
const noSubscribe = () => () => {};
function browserDomain(): string {
  const host = window.location.host;
  return host && !host.includes("localhost") && !host.includes("127.0.0.1") ? host : ROOT_DOMAIN;
}

type Props = {
  value: string;
  onChange: (username: string) => void;
  /** Error from the submitted form; wins over the live check. */
  serverError?: string | null;
  autoFocus?: boolean;
};

/**
 * Username with the store link prefix and a live availability check (reference
 * docs/ui-reference/username.webp): green check when free, red with up to three free suggestions
 * when taken. The check is a hint only; the server decides again when the store is created.
 */
export function UsernameField({ value, onChange, serverError, autoFocus }: Props) {
  const domain = useSyncExternalStore(noSubscribe, browserDomain, () => ROOT_DOMAIN);
  const [check, setCheck] = useState<UsernameCheck | null>(null);
  const latest = useRef(value);

  useEffect(() => {
    latest.current = value;
    if (value.length < SLUG_MIN_LENGTH) return;
    const timer = setTimeout(async () => {
      const result = await checkUsername(value).catch(
        (): UsernameCheck => ({
          status: "error",
          username: value,
          message:
            process.env.NODE_ENV === "development"
              ? "The check request failed before it reached the database. See the terminal running pnpm dev."
              : "Couldn't check that username. Try again.",
        }),
      );
      // Ignore answers for something the user has already changed.
      if (latest.current === value) setCheck(result);
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value]);

  // A result only counts for the value it was made for; anything else is still being checked.
  const current = check?.username === value ? check : null;
  const checking = value.length >= SLUG_MIN_LENGTH && current === null;
  const available = !serverError && current?.status === "available";
  const problem = serverError ?? (current && current.status !== "available" ? current.message : null);
  const suggestions = !serverError && current?.status === "taken" ? current.suggestions : [];

  const hintId = "username-status";

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="username">Username</Label>
      <InputGroup className={cn("overflow-hidden", problem ? "border-danger" : available && "border-mint")}>
        <InputGroupAddon
          aria-hidden="true"
          className={cn("h-full self-stretch border-r px-3 text-sm font-normal sm:px-4 sm:text-base", problem ? "border-danger bg-danger-soft" : "border-line bg-bg-subtle")}
        >
          {domain}/@
        </InputGroupAddon>
        <InputGroupInput
          id="username"
          name="username"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="yourname"
          required
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(normalizeSlugInput(event.target.value))}
          aria-invalid={problem ? true : undefined}
          aria-describedby={hintId}
          className="px-3"
        />
        <InputGroupAddon align="inline-end" aria-hidden="true" className="pr-3">
          {checking ? (
            <Spinner aria-hidden="true" role={undefined} aria-label={undefined} className="size-5 text-mute" />
          ) : available ? (
            <CheckCircle2 className="size-5 fill-mint text-surface" />
          ) : problem ? (
            <AlertCircle className="size-5 fill-danger text-surface" />
          ) : null}
        </InputGroupAddon>
      </InputGroup>

      <div id={hintId} aria-live="polite" className="flex flex-col gap-2">
        {problem ? (
          <FieldError>{problem}</FieldError>
        ) : available ? (
          <p className="flex items-center gap-2 text-sm text-mute">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 fill-mint text-surface" />
            <span>
              Your link: <span className="font-semibold break-all text-mint">{domain}/@{value}</span>
            </span>
          </p>
        ) : (
          <p className="text-sm text-mute">
            {checking ? "Checking..." : `Letters, numbers and hyphens. Your link: ${domain}/@${value || "yourname"}`}
          </p>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-mute">Try:</span>
          {suggestions.map((suggestion) => (
            <Button key={suggestion} type="button" variant="secondary" size="sm" onClick={() => onChange(suggestion)} className="rounded-full font-medium">
              {suggestion}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
