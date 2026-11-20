"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

// The one dropdown of the app (design system): the trigger looks like our text fields (DESIGN.md
// 9.2) and the list looks exactly like the profile menu (DropdownMenu, DESIGN.md 9.7: surface, 1px
// border, radius lg, popover shadow, 40px rows, --accent highlight). Built on Radix Select, so it
// works with the keyboard and screen readers. Replaces the browser's native <select>.

export type ChoiceOption = { value: string; label: React.ReactNode; disabled?: boolean };

/** Radix does not allow an empty value on an item; the empty choice ("Pick a product") uses this. */
const EMPTY = "__empty__";
const toRadix = (value: string) => (value === "" ? EMPTY : value);
const fromRadix = (value: string) => (value === EMPTY ? "" : value);

type Props = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: ChoiceOption[];
  /** Shown when the value matches no option. */
  placeholder?: string;
  /** Submits with a form under this name (a hidden input with the real value). */
  name?: string;
  size?: "sm" | "default";
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

export function ChoiceSelect({ id, value, onValueChange, options, placeholder, name, size = "default", invalid, disabled, className, ...aria }: Props) {
  const known = options.some((option) => option.value === value);
  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <SelectPrimitive.Root value={known ? toRadix(value) : undefined} onValueChange={(next) => onValueChange(fromRadix(next))} disabled={disabled}>
        <SelectPrimitive.Trigger
          id={id}
          data-slot="choice-select-trigger"
          data-size={size}
          aria-invalid={invalid ? true : undefined}
          aria-label={aria["aria-label"]}
          aria-describedby={aria["aria-describedby"]}
          className={cn(
            "flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-line bg-input-soft pr-3 pl-4 text-left text-field text-ink shadow-field data-[size=sm]:h-10 data-[size=sm]:text-sm",
            "transition-[border-color,box-shadow] duration-(--dur-fast) not-disabled:hover:border-input",
            "focus-visible:border-blue focus-visible:ring-4 focus-visible:ring-focus-glow focus-visible:outline-none",
            "data-[state=open]:border-blue disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
            "data-[placeholder]:text-mute",
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            <SelectPrimitive.Value placeholder={placeholder ?? "Choose"} />
          </span>
          <SelectPrimitive.Icon asChild>
            <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-mute" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            className="z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) overflow-hidden rounded-lg border border-line bg-surface text-ink shadow-popover data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:animate-none"
          >
            <SelectPrimitive.Viewport className="max-h-80 p-1.5">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={toRadix(option.value)}
                  disabled={option.disabled}
                  className="relative flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-sm py-2 pr-9 pl-2.5 text-base outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-3 flex items-center text-blue">
                    <Check aria-hidden="true" className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </>
  );
}
