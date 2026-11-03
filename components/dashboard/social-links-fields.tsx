"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { SocialLogo } from "@/components/brand/social-logos";
import { FieldError, FieldHint } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { SOCIAL_LINK_KINDS, SOCIAL_LINK_LABELS, type SocialLinkKind } from "@/lib/config";
import { HANDLE_RULES, checkSocialValue, isHandleKind, socialFieldName } from "@/lib/stores/social-handles";
import { cn } from "@/lib/utils";

const CHECK_DELAY_MS = 500;

export type SocialValues = Record<SocialLinkKind, string>;

/**
 * Social links (D-046): one fixed row per platform with its logo on the left and the username on
 * the right. The link is built from the username; a live check (after a pause or on leaving the
 * field) shows a green check or a red message. Empty rows are simply not shown on the store.
 */
export function SocialLinksFields({
  values,
  onChange,
  fieldError,
}: {
  values: SocialValues;
  onChange: (kind: SocialLinkKind, value: string) => void;
  fieldError: (field: string) => string | null;
}) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {SOCIAL_LINK_KINDS.map((kind) => (
        <SocialRow key={kind} kind={kind} value={values[kind]} onChange={(value) => onChange(kind, value)} serverError={fieldError(socialFieldName(kind))} />
      ))}
    </ul>
  );
}

function SocialRow({ kind, value, onChange, serverError }: { kind: SocialLinkKind; value: string; onChange: (value: string) => void; serverError: string | null }) {
  const id = socialFieldName(kind);
  const label = SOCIAL_LINK_LABELS[kind];
  const rule = isHandleKind(kind) ? HANDLE_RULES[kind] : null;
  // The value the status is about: set after a pause in typing, or at once on blur.
  const [checked, setChecked] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setChecked(value), CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const check = checked === value ? checkSocialValue(kind, value) : null;
  const problem = serverError ?? (check && !check.ok ? check.error : null);
  const valid = !serverError && check?.ok === true;
  const hint = rule ? rule.hint : kind === "email" ? "Buyers can email you from your store page." : "A full link that starts with https://";

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
      <label htmlFor={id} className="flex shrink-0 items-center gap-3 sm:h-11 sm:w-40">
        <span className="flex size-9 items-center justify-center rounded-md border border-line bg-surface">
          <SocialLogo kind={kind} colored />
        </span>
        <span className="text-sm font-semibold">{label}</span>
      </label>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <InputGroup className={cn("overflow-hidden", problem ? "border-danger" : valid && "border-mint")}>
          {rule && (
            <InputGroupAddon aria-hidden="true" className="hidden h-full self-stretch border-r border-line bg-bg-subtle px-3 font-normal sm:flex">
              {rule.prefix}
            </InputGroupAddon>
          )}
          <InputGroupInput
            id={id}
            name={id}
            type={kind === "email" ? "email" : kind === "website" ? "url" : "text"}
            inputMode={kind === "email" ? "email" : kind === "website" ? "url" : "text"}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={rule ? rule.placeholder : kind === "email" ? "you@example.com" : "https://"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => setChecked(value)}
            aria-invalid={problem ? true : undefined}
            aria-describedby={`${id}-status`}
            className="px-3"
          />
          <InputGroupAddon align="inline-end" aria-hidden="true" className="pr-3">
            {valid ? <CheckCircle2 className="size-5 fill-mint text-surface" /> : problem ? <AlertCircle className="size-5 fill-danger text-surface" /> : null}
          </InputGroupAddon>
        </InputGroup>
        <div id={`${id}-status`} aria-live="polite">
          {problem ? (
            <FieldError>{problem}</FieldError>
          ) : valid && check?.ok ? (
            <FieldHint className="truncate">Links to {check.url.replace(/^mailto:/, "").replace(/^https:\/\/(www\.)?/, "")}</FieldHint>
          ) : (
            <FieldHint>{value.trim() ? hint : `Optional. ${hint}`}</FieldHint>
          )}
        </div>
      </div>
    </li>
  );
}
