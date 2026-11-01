"use client";

import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { ROOT_DOMAIN, storeLink } from "@/lib/config";
import { SLUG_MIN_LENGTH, normalizeSlugInput } from "@/lib/slug";
import { checkUsername, type UsernameCheck } from "@/lib/stores/username-check";
import { cn } from "@/lib/utils";

const CHECK_DELAY_MS = 400;

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
      <div
        className={cn(
          "flex h-11 w-full min-w-0 items-stretch overflow-hidden rounded-md border bg-surface transition-colors duration-(--dur-fast)",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          problem ? "border-danger" : available ? "border-mint" : "border-input",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center border-r px-3 text-sm text-mute sm:px-4 sm:text-base",
            problem ? "border-danger bg-danger-soft" : "border-line bg-bg-subtle",
          )}
        >
          {ROOT_DOMAIN}/@
        </span>
        <input
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
          className="min-w-0 flex-1 bg-transparent px-3 text-field text-ink outline-none placeholder:text-mute"
        />
        <span aria-hidden="true" className="flex shrink-0 items-center pr-3">
          {checking ? (
            <LoaderCircle className="size-5 animate-spin text-mute motion-reduce:animate-none" />
          ) : available ? (
            <CheckCircle2 className="size-5 fill-mint text-surface" />
          ) : problem ? (
            <AlertCircle className="size-5 fill-danger text-surface" />
          ) : null}
        </span>
      </div>

      <div id={hintId} aria-live="polite" className="flex flex-col gap-2">
        {problem ? (
          <FieldError>{problem}</FieldError>
        ) : available ? (
          <p className="flex items-center gap-2 text-sm text-mute">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 fill-mint text-surface" />
            <span>
              Your link: <span className="font-semibold break-all text-mint">{storeLink(value)}</span>
            </span>
          </p>
        ) : (
          <p className="text-sm text-mute">
            {checking ? "Checking..." : `Letters, numbers and hyphens. Your link: ${storeLink(value || "yourname")}`}
          </p>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-mute">Try:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onChange(suggestion)}
              className="rounded-full border border-line bg-bg-subtle px-3 py-1.5 text-sm font-medium text-ink transition-colors duration-(--dur-fast) hover:border-blue hover:bg-blue-soft"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
