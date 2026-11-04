"use client";

import type { ReactNode } from "react";

import { FieldError, FieldHint } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { priceDecimals } from "@/lib/products/money";
import { cn } from "@/lib/utils";

// Small form pieces shared by the product and course editors.

export function StepHeading({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-display text-h3">{title}</h2>
      <p className="text-sm text-mute">{body}</p>
    </div>
  );
}

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint ? <FieldHint id={`${id}-hint`}>{hint}</FieldHint> : null}
    </div>
  );
}

export function MoneyInput({ id, currency, value, onChange, invalid }: { id: string; currency: string; value: string; onChange: (value: string) => void; invalid: boolean }) {
  return (
    <InputGroup className={cn("overflow-hidden", invalid && "border-danger")}>
      <InputGroupAddon aria-hidden="true" className="h-full self-stretch border-r border-line bg-bg-subtle px-3 font-semibold">
        {currency.toUpperCase()}
      </InputGroupAddon>
      {/* Whole-number currencies (JPY, ISK...) get a number keyboard and a "0" placeholder (D-046). */}
      <InputGroupInput
        id={id}
        inputMode={priceDecimals(currency) === 0 ? "numeric" : "decimal"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={priceDecimals(currency) === 0 ? "0" : "0.00"}
        aria-invalid={invalid || undefined}
        className="px-3 tabular-nums"
      />
    </InputGroup>
  );
}
