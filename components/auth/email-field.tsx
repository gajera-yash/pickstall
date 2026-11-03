"use client";

import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { useEffect, useState } from "react";

import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkEmailFormat } from "@/lib/auth/email-format";
import { cn } from "@/lib/utils";

const CHECK_DELAY_MS = 500;

type Props = {
  value: string;
  onChange: (email: string) => void;
  /** Error from the submitted form; wins over the live check. */
  serverError?: string | null;
};

/**
 * Email with a live format check, styled like UsernameField: green check when the address looks
 * right, red with a message when it does not. It waits until the user pauses or leaves the field,
 * so nobody is told off mid-typing. Format only; the server checks again on submit.
 */
export function EmailField({ value, onChange, serverError }: Props) {
  // The value the hint is about: set after a pause in typing, or right away on blur.
  const [checked, setChecked] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setChecked(value), CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const format = checked === value ? checkEmailFormat(value) : null;
  const valid = !serverError && format?.status === "valid";
  const problem = serverError ?? (format?.status === "invalid" ? format.message : null);
  const errorId = "email-error";

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="email">Email</Label>
      <div className="relative">
        <Mail aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-mute" />
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="maya@example.com"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setChecked(value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? errorId : undefined}
          className={cn("pr-11 pl-12", problem ? "border-danger" : valid ? "border-mint" : undefined)}
        />
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
          {valid ? (
            <CheckCircle2 className="size-5 fill-mint text-surface" />
          ) : problem ? (
            <AlertCircle className="size-5 fill-danger text-surface" />
          ) : null}
        </span>
      </div>
      <div aria-live="polite">{problem && <FieldError id={errorId}>{problem}</FieldError>}</div>
    </div>
  );
}
